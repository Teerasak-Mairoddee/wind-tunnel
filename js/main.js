// Entry point: switches between the shape editor and the running tunnel, picks the solver
// (WebGPU when available, CPU otherwise) and runs the main loop.
import { NX, NY, N, setGrid, RESOLUTIONS } from './config.js';
import { $, fmt, bindOut, showMsg } from './dom.js';
import { app } from './state.js';
import { view, resizeMask } from './canvases.js';
import { sim, step, initFlow, solidChanged, allocate, recordForces } from './solver/lbm.js';
import { GpuSolver } from './solver/gpu.js';
import { genAirfoil, shapePreset, clearShape, initDrawing, onShapeChange, rasterizeToSolid } from './shape.js';
import { drawEditor } from './render/editor.js';
import { renderFlow, seedParticles, moveParticles, updateLegend, allocFlow, setParticleCount, DEFAULT_PARTICLES } from './render/flow.js';
import { updateStats, drawSpark } from './ui/stats.js';
import { updateFly, syncFlyAoa, initFly } from './ui/fly.js';
import { initHints } from './ui/hints.js';
import { initPresets } from './ui/presets.js';

const UNSTABLE_MSG = 'The simulation went unstable. Raise the viscosity or lower the wind speed, then press Restart flow.';
const PREF_KEY = 'wt-solver';

/* ---------- solver choice ---------- */
let gpu = null;          // GpuSolver once WebGPU is ready
let useGpu = false;      // true while the GPU is the active solver
let runGen = 0;          // bumped on every restart so late GPU results from an old run are dropped
let gpuPending = null;   // promise of the GPU run in flight, if any

function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; } }
function savePrefs() {
  const p = { solver: $('solverSel').value, res: gpuSettings.res, spf: gpuSettings.spf, smoke: $('smoke').value };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
}

// The CPU solver runs on the page's main thread, so CPU mode is held to safe settings:
// the smallest grid and a low step count. GPU settings are remembered and restored.
const CPU_LIMITS = { res: 'standard', spf: 10, spfMax: 15 };
const GPU_SPF_MAX = 60;
let gpuSettings = { res: 'high', spf: 30 };

function setSpf(value, max) {
  const el = $('spf');
  el.max = max; el.value = Math.min(value, max);
  el.dispatchEvent(new Event('input'));
}
function lockLargeGrids(locked) {
  ['high', 'ultra'].forEach(k => { $('resSel').querySelector(`[value=${k}]`).disabled = locked; });
}

// The smoke amount slider is a GPU-only extra; the CPU solver keeps the default count.
function applySmoke() {
  $('smokeRow').hidden = !useGpu;
  setParticleCount(useGpu ? +$('smoke').value : DEFAULT_PARTICLES);
}

function solverNote() {
  applySmoke();
  const where = useGpu ? `GPU (${gpu.adapterName})` : 'CPU';
  const missing = gpu ? '' : ' WebGPU isn’t available in this browser, so the CPU solver is used.';
  const limits = useGpu ? '' : ` CPU mode is limited to ${RESOLUTIONS[CPU_LIMITS.res].join(' × ')} and ${CPU_LIMITS.spfMax} steps per frame to keep the page responsive.`;
  $('solverNote').textContent = `Running on ${where} · ${NX} × ${NY} cells.${missing}${limits}`;
}

// Solid cells for the GPU: 1 solid, 2 = was solid and has just opened up, 0 fluid.
function gpuFlags(oldSolid) {
  const fl = new Uint32Array(N), s = sim.solid;
  for (let k = 0; k < N; k++) fl[k] = s[k] ? 1 : (oldSolid && oldSolid[k] ? 2 : 0);
  return fl;
}

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
  if (useGpu) gpu.setFlags(gpuFlags(old));
  if (sim.blown) restartFlow();
}

function restartFlow() {
  runGen++;
  initFlow();
  if (useGpu) { gpu.resize(NX, NY); gpu.setFlags(gpuFlags(null)); gpu.init(sim.uIn, sim.nu); }
  seedParticles(); showMsg('');
}

/* ---------- main loop ---------- */
let perfMs = 0, perfSteps = 0, frameN = 0;

function cpuSteps(n) {
  const t0 = performance.now();
  for (let s = 0; s < n && !sim.blown; s++) step();
  perfMs += performance.now() - t0; perfSteps += n;
  moveParticles(n);
  if (sim.blown) showMsg(UNSTABLE_MSG);
}

async function gpuSteps(n) {
  const gen = runGen, t0 = performance.now();
  let res;
  try { res = await (gpuPending = gpu.run(n, sim.uIn, sim.nu)); }
  catch (e) { gpu.busy = false; if (gen === runGen) fallBackToCpu(e); return; }
  finally { gpuPending = null; }
  if (gen !== runGen || app.mode !== 'sim') return;     // a restart happened meanwhile
  sim.rho.set(res.rho); sim.ux.set(res.ux); sim.uy.set(res.uy);
  for (let s = 0; s < n && !sim.blown; s++) recordForces(res.forces[2 * s], res.forces[2 * s + 1]);
  perfMs += performance.now() - t0; perfSteps += n;
  moveParticles(n);
  if (sim.blown) showMsg(UNSTABLE_MSG);
}

function fallBackToCpu(err) {
  console.warn('GPU solver failed, switching to CPU:', err);
  gpu = null; useGpu = false;
  const opt = $('solverSel').querySelector('[value=gpu]'); opt.disabled = true;
  setSolver('cpu');
}

function loop() {
  if (app.mode !== 'sim') return;
  if (liveDirty) applyLiveShape();
  if (!app.paused && !sim.blown) {
    const n = +$('spf').value;
    if (useGpu) { if (!gpu.busy) gpuSteps(n); }
    else cpuSteps(n);
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

/* ---------- grid resolution / solver switching ---------- */
// Grid and solver changes may wait for a GPU run to finish, so they are queued and
// applied strictly one after another.
let changes = Promise.resolve();
const queueChange = fn => (changes = changes.then(fn).catch(e => console.warn(e)));

async function applyResolution(key) {
  const [nx, ny] = RESOLUTIONS[key];
  $('resSel').value = key;
  if (nx === NX && ny === NY) { solverNote(); return; }
  runGen++;
  // Only wait for an in-flight GPU batch if its buffers are about to be replaced.
  if (useGpu && gpuPending) { try { await gpuPending; } catch (e) { /* ignore */ } }
  setGrid(nx, ny);
  allocate(); allocFlow(); resizeMask();
  if (app.shapeSource === 'airfoil') genAirfoil();       // rebuild the wing crisply at the new size
  if (useGpu) gpu.resize(nx, ny);
  resize();
  if (app.mode === 'sim') { rasterizeToSolid(); restartFlow(); updateStats(0); liveDirty = false; }
  solverNote();
}

async function applySolver(kind) {
  runGen++;                                   // any GPU batch still in flight is ignored when it lands
  useGpu = kind === 'gpu' && !!gpu;
  if (useGpu && gpuPending) { try { await gpuPending; } catch (e) { /* ignore */ } }
  $('solverSel').value = useGpu ? 'gpu' : 'cpu';
  if (useGpu) {
    const { res, spf } = gpuSettings;                     // copy first: setSpf fires input events
    lockLargeGrids(false);
    setSpf(spf, GPU_SPF_MAX);
    await applyResolution(res);
  } else {
    lockLargeGrids(true);
    setSpf(CPU_LIMITS.spf, CPU_LIMITS.spfMax);
    await applyResolution(CPU_LIMITS.res);
  }
  if (app.mode === 'sim') { rasterizeToSolid(); restartFlow(); }
  solverNote();
}

const setResolution = key => queueChange(() => applyResolution(key));
const setSolver = kind => queueChange(() => applySolver(kind));

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
  restartFlow(); updateLegend(); updateStats(0); updateFly(); solverNote();
  requestAnimationFrame(loop);
}

function toEdit() {
  app.mode = 'edit'; showMsg('');
  runGen++;
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
bindOut('spf', () => { if (useGpu) { gpuSettings.spf = +$('spf').value; savePrefs(); } });
bindOut('smoke', () => { applySmoke(); savePrefs(); });
$('viewSel').onchange = updateLegend;
$('editBtn').onclick = toEdit;
$('resetBtn').onclick = restartFlow;
$('pauseBtn').onclick = () => { app.paused = !app.paused; $('pauseBtn').textContent = app.paused ? 'Resume' : 'Pause'; };
$('solverSel').onchange = () => { setSolver($('solverSel').value); savePrefs(); };
$('resSel').onchange = () => { if (useGpu) gpuSettings.res = $('resSel').value; setResolution($('resSel').value).then(savePrefs); };

// panels
initPresets();
initFly();
initHints();

window.addEventListener('resize', resize);
resize();
genAirfoil();

// Start on the CPU, then switch to WebGPU as soon as it is ready.
const prefs = loadPrefs();
if (prefs.smoke) { $('smoke').value = prefs.smoke; $('o_smoke').textContent = fmt.smoke($('smoke').value); }   // restore without re-saving
if (prefs.res) gpuSettings = { res: prefs.res, spf: +prefs.spf || 30 };
$('solverSel').querySelector('[value=gpu]').disabled = true;
lockLargeGrids(true);                                    // CPU limits until the GPU is ready
setSpf(CPU_LIMITS.spf, CPU_LIMITS.spfMax);
solverNote();
GpuSolver.create().then(g => {
  if (!g) { solverNote(); return; }
  gpu = g;
  $('solverSel').querySelector('[value=gpu]').disabled = false;
  if (app.mode === 'sim' || prefs.solver === 'cpu') { solverNote(); return; }   // don't swap solvers under a running flow
  setSolver('gpu');
});
