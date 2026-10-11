// The on-screen tunnel canvas plus two off-screen canvases at grid resolution.
import { NX, NY } from './config.js';
import { $ } from './dom.js';

export const view = $('view');
export const vctx = view.getContext('2d');

// Shape mask: any pixel with alpha > 50% is a solid wall.
export const mask = document.createElement('canvas');
mask.width = NX; mask.height = NY;
export const mctx = mask.getContext('2d', { willReadFrequently: true });
