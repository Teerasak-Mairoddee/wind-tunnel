// The on-screen tunnel canvas plus the off-screen shape mask at grid resolution.
import { NX, NY } from './config.js';
import { $ } from './dom.js';

export const view = $('view');
export const vctx = view.getContext('2d');

// Shape mask: any pixel with alpha > 50% is a solid wall.
export const mask = document.createElement('canvas');
mask.width = NX; mask.height = NY;
export const mctx = mask.getContext('2d', { willReadFrequently: true });

/** Resize the mask to the current grid, scaling the existing shape to fit. */
export function resizeMask() {
  if (mask.width === NX && mask.height === NY) return;
  const old = document.createElement('canvas');
  old.width = mask.width; old.height = mask.height;
  old.getContext('2d').drawImage(mask, 0, 0);
  mask.width = NX; mask.height = NY;                // also clears the canvas
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(old, 0, 0, NX, NY);
}
