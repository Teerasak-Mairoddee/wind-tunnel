// Entry point: switches between the shape editor and the running tunnel, and runs the main loop.
import { NX, NY, N } from './config.js';
import { $, bindOut, showMsg } from './dom.js';
import { app } from './state.js';
import { view } from './canvases.js';
import { sim, step, initFlow, solidChanged } from './solver/lbm.js';
import { genAirfoil, shapePreset, clearShape, initDrawing, onShapeChange, rasterizeToSolid } from './shape.js';
import { drawEditor } from './render/editor.js';
import { renderFlow, seedParticles, moveParticles, updateLegend } from './render/flow.js';
import { updateStats, drawSpark } from './ui/stats.js';
import { updateFly, syncFlyAoa, initFly } from './ui/fly.js';
import { initHints } from './ui/hints.js';
import { initPresets } from './ui/presets.js';

/* ---------- canvas sizing ---------- */
function resize() {
  const dpr = window.devicePixelRatio || 1, w = view.clientWidth;
  view.width = Math.round(w * dpr); view.height = Math.round(w * NY / NX * dpr);
  if (app.mode === 'edit') drawEditor(); else renderFlow();
}

/* ---------- shape changes ---------- */
// In the editor a change just redraws; while simulating it is applied on the next frame.
let liveDirty = false;
onShapeChange(() => { if (app.mode === 'edit') drawEditor(); else liveDirty = true; });

function applyLiveShape() {
  liveDirty = false;
  const old = sim.solid.slice();
  rasterizeToSolid();
  solidChanged(old);
  if (sim.blown) restartFlow();
}

function restartFlow() { initFlow(); seedParticles(); showMsg(''); }

/* ---------- main loop ---------- */
let perfMs = 0, perfSteps = 0, frameN = 0;
function loop() {
  if (app.mode !== 'sim') return;
  if (liveDirty) applyLiveShape();
  if (!app.paused && !sim.blown) {
    const n = +$('spf').value, t0 = performance.now();
    for (let s = 0; s < n && !sim.blown; s++) step();
    perfMs += performance.now() - t0; perfSteps += n;
    moveParticles(n);
    if (sim.blown) showMsg('The simulation went unstable. Raise the viscosity or lower the wind speed, then press Restart flow.');
  }
  renderFlow();
  if (++frameN % 6 === 0) {                     // refresh numbers ~10× per second
    updateStats(perfMs > 0 ? perfSteps * N / (perfMs * 1000) : 0);
    updateFly();
    drawSpark();
    perfMs = perfSteps = 0;
  }
  requestAnimationFrame(loop);
}

/* ---------- modes ---------- */
function startSim() {
  if (!rasterizeToSolid()) {
    showMsg('There is no shape in the tunnel yet. Draw something or pick a preset.');
    setTimeout(() => showMsg(''), 2200);
    return;
  }
  app.mode = 'sim'; app.paused = false; $('pauseBtn').textContent = 'Pause';
  $('editPanel').hidden = true; $('simPanel').hidden = false; $('flyPanel').hidden = false;
  syncFlyAoa();
  $('stage').classList.remove('drawing');
  document.body.classList.add('simming'); $('legend').classList.add('show'); $('flowtag').hidden = true;
  sim.uIn = +$('speed').value; sim.nu = +$('visc').value;
  restartFlow(); updateLegend(); updateStats(0); updateFly();
  requestAnimationFrame(loop);
}

function toEdit() {
  app.mode = 'edit'; showMsg('');
  $('editPanel').hidden = false; $('simPanel').hidden = true; $('flyPanel').hidden = true;
  document.body.classList.remove('simming');
  $('legend').classList.remove('show'); $('flowtag').hidden = false;
  $('stage').classList.toggle('drawing', app.tab === 'draw');
  drawEditor();
}

function setTab(t) {
  app.tab = t;
  $('tabAirfoil').classList.toggle('on', t === 'airfoil'); $('tabDraw').classList.toggle('on', t === 'draw');
  $('airfoilCtl').hidden = t !== 'airfoil'; $('drawCtl').hidden = t !== 'draw';
  $('stage').classList.toggle('drawing', t === 'draw');
  if (t === 'airfoil') genAirfoil();
}

/* ---------- wiring ---------- */
// shape editor
['m', 'p', 't', 'aoa', 'chord'].forEach(id => bindOut(id, genAirfoil));
bindOut('brush');
$('tabAirfoil').onclick = () => setTab('airfoil');
$('tabDraw').onclick = () => setTab('draw');
document.querySelectorAll('#toolChips [data-tool]').forEach(b => b.onclick = () => {
  app.tool = b.dataset.tool;
  document.querySelectorAll('#toolChips [data-tool]').forEach(x => x.classList.toggle('on', x === b));
});
$('clearBtn').onclick = clearShape;
document.querySelectorAll('#shapePresets button').forEach(b => b.onclick = () => shapePreset(b.dataset.shape));
$('runBtn').onclick = startSim;
initDrawing();

// tunnel controls
bindOut('speed', () => { sim.uIn = +$('speed').value; });
bindOut('visc', () => { sim.nu = +$('visc').value; });
bindOut('spf');
$('viewSel').onchange = updateLegend;
$('editBtn').onclick = toEdit;
$('resetBtn').onclick = restartFlow;
$('pauseBtn').onclick = () => { app.paused = !app.paused; $('pauseBtn').textContent = app.paused ? 'Resume' : 'Pause'; };

// panels
initPresets();
initFly();
initHints();

window.addEventListener('resize', resize);
resize();
genAirfoil();
