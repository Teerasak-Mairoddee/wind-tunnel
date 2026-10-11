// Draws the empty tunnel grid and the current shape while editing.
import { NX, NY, cellScale } from '../config.js';
import { view, vctx, mask } from '../canvases.js';

export function drawEditor() {
  const W = view.width, H = view.height, sx = W / NX;
  vctx.fillStyle = '#06090d'; vctx.fillRect(0, 0, W, H);
  vctx.strokeStyle = 'rgba(120,150,190,0.08)'; vctx.lineWidth = 1;
  vctx.beginPath();
  const gap = 20 * cellScale();
  for (let x = 0; x <= NX; x += gap) { vctx.moveTo(x * sx, 0); vctx.lineTo(x * sx, H); }
  for (let y = 0; y <= NY; y += gap) { vctx.moveTo(0, y * sx); vctx.lineTo(W, y * sx); }
  vctx.stroke();
  vctx.strokeStyle = 'rgba(120,150,190,0.25)'; vctx.setLineDash([4, 6]);
  vctx.beginPath(); vctx.moveTo(0, H / 2); vctx.lineTo(W, H / 2); vctx.stroke(); vctx.setLineDash([]);
  vctx.imageSmoothingEnabled = false;
  vctx.drawImage(mask, 0, 0, W, H);
}
