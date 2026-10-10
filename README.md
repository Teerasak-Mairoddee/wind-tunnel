# Browser Wind Tunnel

Design a wing (or draw any shape) and run a 2D computational fluid dynamics simulation of it, live in your browser. No install, no server, no build step.

## Features

- **Wing editor**: NACA 4-digit airfoils with sliders for camber, camber position, thickness, angle of attack and chord, plus presets (0012, 2412, 4415, 6409).
- **Freehand drawing**: draw or erase directly in the tunnel, edit a generated wing by hand, or start from a cylinder, flat plate, square or wedge.
- **Live wind tunnel**: velocity, vorticity and pressure views, with smoke streaklines.
- **Stats**: lift coefficient (C<sub>L</sub>), drag coefficient (C<sub>D</sub>), L/D, Reynolds number, a C<sub>L</sub>/C<sub>D</sub> history chart, and solver speed.

## How it works

The solver is a D2Q9 **lattice Boltzmann method** on a 400 × 160 grid:

- BGK collision with a Smagorinsky sub-grid model, so it stays stable at higher Reynolds numbers
- Half-way bounce-back on solid cells (any drawn pixel becomes a wall)
- Fixed-velocity inlet on the left, zero-gradient outlet on the right, periodic top/bottom
- Forces computed by the momentum-exchange method, then normalised into C<sub>L</sub> and C<sub>D</sub>

Airfoils are normalised by chord; drawn shapes by frontal height.

## Limitations

Results are qualitative. The simulation is 2D, runs at low Reynolds numbers (hundreds to a few thousand, versus millions for real aircraft), and the grid is coarse. Use it to compare shapes and understand flow behaviour, not to certify a design.

## Run locally

Open `index.html` in any modern browser.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository (with `index.html` at the root).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Ideas for next steps

- Move the solver to WebGPU for larger grids and faster runs
- Export the shape as an image or SVG, and import outlines from CAD
- Show a surface pressure-distribution (C<sub>p</sub>) plot along the wing
- Run an angle-of-attack sweep to plot a lift curve and find the stall angle
