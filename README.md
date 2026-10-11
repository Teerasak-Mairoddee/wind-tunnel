# Browser Wind Tunnel

Design a wing (or draw any shape) and run a 2D computational fluid dynamics simulation of it, live in your browser. No install and no build step: plain HTML, CSS and JavaScript modules.

**Live site:** https://teerasak-mairoddee.github.io/wind-tunnel/

## Features

- **Wing editor**: NACA 4-digit airfoils with sliders for camber, camber position, thickness, angle of attack and chord, plus a presets menu with classic sections (0012, 2412, 4415, 6409) and the real wing sections of the Cessna 172, Spitfire, DC-3, B-17, A6M Zero, P-39, Aeronca Champion and Air Tractor AT-301, including root and tip where they differ.
- **Freehand drawing**: draw or erase directly in the tunnel, edit a generated wing by hand, or start from a cylinder, flat plate, square or wedge.
- **Live wind tunnel**: velocity, vorticity and pressure views, with smoke streaklines.
- **Stats**: lift coefficient (C<sub>L</sub>), drag coefficient (C<sub>D</sub>), L/D, Reynolds number, a C<sub>L</sub>/C<sub>D</sub> history chart, and solver speed.
- **Will it fly?**: enter mass, wingspan, chord, airspeed and altitude to see whether the wing lifts the plane, its minimum flying speed, and a to-scale top view. An angle-of-attack slider tilts the wing in the running simulation.
- **Hints**: every control and result has a "?" explaining what it does and how it changes the outcome.

## Project structure

```
index.html              Page markup
css/
  styles.css            All styling
js/
  main.js               Entry point: editor/tunnel modes, main loop, control wiring
  config.js             Grid size and shared constants
  dom.js                DOM helpers (element lookup, slider outputs, messages)
  state.js              Shared UI state (mode, tab, tool, shape source)
  canvases.js           Tunnel canvas and the off-screen shape mask
  shape.js              Wing generator, drawing tools, presets, mask → solid cells
  solver/
    airfoil.js          NACA 4-digit geometry (pure maths)
    lbm.js              Lattice Boltzmann solver and force coefficients (no DOM)
  render/
    editor.js           Editor view (grid + shape)
    flow.js             Flow view (colour maps, smoke particles, legend)
  data/
    presets.js          Wing section presets (classic NACA + famous aircraft)
  ui/
    stats.js            Stat tiles and C_L/C_D chart
    fly.js              "Will it fly?" panel and top-view drawing
    hints.js            "?" buttons and pop-up text
    presets.js          Presets dropdown
```

The solver modules have no DOM code, so they can be reused elsewhere, for example moved into a Web Worker or ported to WebGPU.

## How it works

The solver is a D2Q9 **lattice Boltzmann method** on a 400 × 160 grid:

- BGK collision with a Smagorinsky sub-grid model, so it stays stable at higher Reynolds numbers
- Half-way bounce-back on solid cells (any drawn pixel becomes a wall)
- Fixed-velocity inlet on the left, zero-gradient outlet on the right, periodic top/bottom
- Forces computed by the momentum-exchange method, then normalised into C<sub>L</sub> and C<sub>D</sub>

Airfoils are normalised by chord; drawn shapes by frontal height.

"Will it fly?" uses the lift equation L = ½ρV²SC<sub>L</sub>, with the 2D C<sub>L</sub> scaled by AR / (AR + 2) to account for lift lost at the wingtips.

## Limitations

Results are qualitative. The simulation is 2D, runs at low Reynolds numbers (hundreds to a few thousand, versus millions for real aircraft), and the grid is coarse. Use it to compare shapes and understand flow behaviour, not to certify a design.

## Run locally

Browsers only load JavaScript modules over HTTP, so opening `index.html` straight from disk won't work. Start a small local server in the project folder instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository (with `index.html` at the root).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`. Every push to `main` updates it.

## Ideas for next steps

- Move the solver to WebGPU for larger grids and faster runs
- Export the shape as an image or SVG, and import outlines from CAD
- Show a surface pressure-distribution (C<sub>p</sub>) plot along the wing
- Run an angle-of-attack sweep to plot a lift curve and find the stall angle
