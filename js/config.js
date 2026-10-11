// Grid size and shared constants.
// NX / NY / N are live bindings: importers always see the current grid after setGrid().
export let NX = 400;          // cells along the tunnel (flow direction)
export let NY = 160;          // cells across the tunnel
export let N = NX * NY;

// Grid resolutions offered in the tunnel panel (all 2.5 : 1, matching the view).
export const RESOLUTIONS = {
  standard: [400, 160],
  high: [800, 320],
  ultra: [1200, 480]
};

export function setGrid(nx, ny) { NX = nx; NY = ny; N = nx * ny; }

// Grid cells per "standard" cell, for keeping brush sizes and drawing details consistent.
export const cellScale = () => NX / 400;

export const SHAPE_COL = '#dbe6f3';   // colour used to paint solid shapes on the mask canvas
