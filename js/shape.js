// Shape editing: NACA generator, drawing tools, presets, and turning the mask into solid cells.
import { NX, NY, SHAPE_COL } from './config.js';
import { $ } from './dom.js';
import { app } from './state.js';
import { view, mctx } from './canvases.js';
import { airfoilPoly } from './solver/airfoil.js';
import { sim } from './solver/lbm.js';

// main.js decides what a change means (redraw editor, or update the running flow).
let onChange = () => {};
export function onShapeChange(fn) { onChange = fn; }

/** Rebuild the mask from the Wing sliders. */
export function genAirfoil() {
  const m = $('m').value / 100, p = $('p').value / 10, t = $('t').value / 100;
  app.chordCells = Math.round(NX * $('chord').value / 100);
  const pts = airfoilPoly(m, p, t, +$('aoa').value, app.chordCells);
  mctx.clearRect(0, 0, NX, NY);
  mctx.fillStyle = SHAPE_COL;
  mctx.beginPath();
  pts.forEach(([x, y], i) => i ? mctx.lineTo(x, y) : mctx.moveTo(x, y));
  mctx.closePath(); mctx.fill();
  app.shapeSource = 'airfoil';
  onChange();
}

/** Replace the mask with a reference shape. */
export function shapePreset(kind) {
  mctx.clearRect(0, 0, NX, NY);
  mctx.fillStyle = SHAPE_COL;
  const cx = NX * 0.25, cy = NY / 2, s = NY * 0.11;
  mctx.beginPath();
  if (kind === 'cylinder') mctx.arc(cx, cy, s, 0, Math.PI * 2);
  if (kind === 'plate') mctx.rect(cx - 2, cy - s * 1.3, 4, s * 2.6);
  if (kind === 'square') mctx.rect(cx - s, cy - s, 2 * s, 2 * s);
  if (kind === 'wedge') { mctx.moveTo(cx - s * 1.6, cy); mctx.lineTo(cx + s * 1.4, cy - s); mctx.lineTo(cx + s * 1.4, cy + s); mctx.closePath(); }
  mctx.fill();
  app.shapeSource = 'drawn';
  onChange();
}

export function clearShape() {
  mctx.clearRect(0, 0, NX, NY);
  app.shapeSource = 'drawn';
  onChange();
}

/* ---------- freehand drawing ---------- */
function toGrid(e) {
  const r = view.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * NX, (e.clientY - r.top) / r.height * NY];
}
function stroke(a, b) {
  mctx.save();
  mctx.globalCompositeOperation = app.tool === 'erase' ? 'destination-out' : 'source-over';
  mctx.strokeStyle = mctx.fillStyle = SHAPE_COL;
  mctx.lineWidth = +$('brush').value; mctx.lineCap = 'round';
  mctx.beginPath(); mctx.moveTo(a[0], a[1]); mctx.lineTo(b[0], b[1]); mctx.stroke();
  mctx.beginPath(); mctx.arc(b[0], b[1], mctx.lineWidth / 2, 0, Math.PI * 2); mctx.fill();
  mctx.restore();
  onChange();
}
export function initDrawing() {
  let drawing = false, last = null;
  view.addEventListener('pointerdown', e => {
    if (app.mode !== 'edit' || app.tab !== 'draw') return;
    drawing = true; view.setPointerCapture(e.pointerId);
    last = toGrid(e); stroke(last, last);
  });
  view.addEventListener('pointermove', e => {
    if (!drawing) return;
    const g = toGrid(e); stroke(last, g); last = g;
  });
  ['pointerup', 'pointercancel'].forEach(ev => view.addEventListener(ev, () => { drawing = false; }));
}

/**
 * Copy the mask into sim.solid and set the reference length used for C_L / C_D.
 * @returns {boolean} false if the tunnel is empty
 */
export function rasterizeToSolid() {
  const d = mctx.getImageData(0, 0, NX, NY).data, solid = sim.solid;
  let count = 0, minY = NY, maxY = -1;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const k = y * NX + x;
    const s = d[k * 4 + 3] > 127 && x > 2 && x < NX - 3 ? 1 : 0;    // keep clear of inlet/outlet columns
    solid[k] = s;
    if (s) { count++; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (!count) return false;
  if (app.shapeSource === 'airfoil') {
    sim.refLen = app.chordCells;
    $('refNote').textContent = 'ref. length: chord (' + sim.refLen + ' cells)';
  } else {
    sim.refLen = maxY - minY + 1;
    $('refNote').textContent = 'ref. length: frontal height (' + sim.refLen + ' cells)';
  }
  return true;
}
