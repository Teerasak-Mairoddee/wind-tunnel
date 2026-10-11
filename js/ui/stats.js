// Stat tiles and the C_L / C_D history chart in the tunnel panel.
import { $ } from '../dom.js';
import { sim } from '../solver/lbm.js';

const fmtN = v => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(3));

export function updateStats(mlups) {
  const { clAvg, cdAvg } = sim;
  $('sCl').textContent = fmtN(clAvg);
  $('sCd').textContent = fmtN(cdAvg);
  $('sLD').textContent = Math.abs(cdAvg) > 1e-4 ? fmtN(clAvg / cdAvg) : '–';
  $('sRe').textContent = Math.round(sim.uIn * sim.refLen / sim.nu).toLocaleString();
  $('sSteps').textContent = sim.steps.toLocaleString();
  if (mlups) $('sPerf').textContent = mlups.toFixed(1);
}

export function drawSpark() {
  const cv = $('spark'), dpr = window.devicePixelRatio || 1, hist = sim.hist;
  const W = cv.width = cv.clientWidth * dpr, H = cv.height = cv.clientHeight * dpr;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  if (hist.length < 2) return;
  let lo = 0, hi = 0;
  for (const [a, b] of hist) { lo = Math.min(lo, a, b); hi = Math.max(hi, a, b); }
  const pad = (hi - lo) * 0.1 + 1e-3; lo -= pad; hi += pad;
  const Y = v => H - (v - lo) / (hi - lo) * H;
  c.strokeStyle = 'rgba(139,153,173,0.3)'; c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(W, Y(0)); c.stroke();
  [[0, '#4cc2ff'], [1, '#ff9f43']].forEach(([j, col]) => {
    c.strokeStyle = col; c.lineWidth = 2 * dpr; c.beginPath();
    hist.forEach((h, i) => { const x = i / 299 * W; i ? c.lineTo(x, Y(h[j])) : c.moveTo(x, Y(h[j])); });
    c.stroke();
  });
}
