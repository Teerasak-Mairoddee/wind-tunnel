// Draws the running simulation: colour-mapped field, smoke particles, legend.
import { NX, NY, N } from '../config.js';
import { $ } from '../dom.js';
import { view, vctx, mask } from '../canvases.js';
import { sim } from '../solver/lbm.js';

/* ---------- colour maps ---------- */
function lut(stops) {
  const out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let j = 0;
    while (j < stops.length - 2 && t > stops[j + 1][0]) j++;
    const [t0, c0] = stops[j], [t1, c1] = stops[j + 1], s = (t - t0) / (t1 - t0);
    for (let c = 0; c < 3; c++) out[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * s;
  }
  return out;
}
const MAPS = {
  speed: lut([[0, [8, 10, 30]], [0.3, [70, 30, 140]], [0.55, [190, 55, 100]], [0.8, [250, 145, 30]], [1, [252, 250, 170]]]),
  vort: lut([[0, [70, 150, 255]], [0.5, [10, 14, 22]], [1, [255, 90, 70]]]),
  press: lut([[0, [40, 200, 230]], [0.5, [14, 18, 28]], [1, [255, 170, 50]]])
};
const CSS_GRAD = {
  speed: 'linear-gradient(90deg,#080a1e,#461e8c,#be3764,#fa911e,#fcfaaa)',
  vort: 'linear-gradient(90deg,#4696ff,#0a0e16,#ff5a46)',
  press: 'linear-gradient(90deg,#28c8e6,#0e121c,#ffaa32)'
};
const LEG = { speed: ['still', 'fast'], vort: ['clockwise', 'anticlockwise'], press: ['suction (Cp −1.5)', 'Cp +1.5'] };

export function updateLegend() {
  const k = $('viewSel').value;
  $('legBar').style.background = CSS_GRAD[k];
  $('legLo').textContent = LEG[k][0]; $('legHi').textContent = LEG[k][1];
}

/* ---------- field image ---------- */
const fieldCv = document.createElement('canvas'); fieldCv.width = NX; fieldCv.height = NY;
const fctx = fieldCv.getContext('2d');
const fimg = fctx.createImageData(NX, NY);
const curl = new Float32Array(N);

function renderField() {
  const { ux, uy, rho, solid } = sim;
  const kind = $('viewSel').value, map = MAPS[kind], d = fimg.data, u0 = Math.max(sim.uIn, 1e-4);
  if (kind === 'vort') {
    for (let y = 1; y < NY - 1; y++) for (let x = 1; x < NX - 1; x++) {
      const k = y * NX + x;
      curl[k] = (uy[k + 1] - uy[k - 1]) - (ux[k + NX] - ux[k - NX]);
    }
  }
  const qInv = 1 / (0.5 * u0 * u0);
  for (let k = 0; k < N; k++) {
    const o = k * 4;
    if (solid[k]) { d[o] = 120; d[o + 1] = 132; d[o + 2] = 150; d[o + 3] = 255; continue; }
    let s;
    if (kind === 'speed') s = Math.sqrt(ux[k] * ux[k] + uy[k] * uy[k]) / (1.7 * u0);
    else if (kind === 'vort') s = 0.5 - curl[k] / (0.35 * u0);
    else s = 0.5 + ((rho[k] - 1) / 3) * qInv / 3;
    let i = (s * 255) | 0; if (i < 0) i = 0; else if (i > 255) i = 255;
    d[o] = map[i * 3]; d[o + 1] = map[i * 3 + 1]; d[o + 2] = map[i * 3 + 2]; d[o + 3] = 255;
  }
  fctx.putImageData(fimg, 0, 0);
}

/* ---------- smoke particles (released in lanes from the inlet) ---------- */
const NP = 2400, LANES = 24, px = new Float32Array(NP), py = new Float32Array(NP);
const laneY = i => ((i % LANES) + 0.5) * NY / LANES + (Math.random() - 0.5) * 0.6;

export function seedParticles() {
  for (let i = 0; i < NP; i++) { px[i] = Math.random() * NX; py[i] = laneY(i); }
}
export function moveParticles(n) {
  const { ux, uy, solid } = sim;
  for (let i = 0; i < NP; i++) {
    const k = (py[i] | 0) * NX + (px[i] | 0);
    px[i] += ux[k] * n; py[i] += uy[k] * n;
    if (px[i] >= NX - 1 || px[i] < 0 || py[i] < 0 || py[i] >= NY || solid[(py[i] | 0) * NX + (px[i] | 0)]) {
      px[i] = Math.random() * 3; py[i] = laneY(i);
    }
  }
}

export function renderFlow() {
  const W = view.width, H = view.height, sx = W / NX;
  renderField();
  vctx.imageSmoothingEnabled = true;
  vctx.drawImage(fieldCv, 0, 0, W, H);
  if ($('particles').checked) {
    vctx.fillStyle = 'rgba(255,255,255,0.55)';
    const r = Math.max(1, sx * 0.6);
    for (let i = 0; i < NP; i++) vctx.fillRect(px[i] * sx, py[i] * sx, r, r);
  }
  vctx.imageSmoothingEnabled = false;
  vctx.globalAlpha = 0.35; vctx.drawImage(mask, 0, 0, W, H); vctx.globalAlpha = 1;
}
