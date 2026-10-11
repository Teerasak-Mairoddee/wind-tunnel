// UI-level state shared between modules.
export const app = {
  mode: 'edit',            // 'edit' (shape editor) or 'sim' (wind tunnel running)
  tab: 'airfoil',          // editor tab: 'airfoil' or 'draw'
  tool: 'draw',            // drawing tool: 'draw' or 'erase'
  shapeSource: 'airfoil',  // 'airfoil' (NACA generator) or 'drawn' (freehand / preset)
  chordCells: 0,           // airfoil chord length in grid cells
  paused: false
};
