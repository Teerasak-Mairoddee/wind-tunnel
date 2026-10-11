// D2Q9 lattice Boltzmann solver.
// BGK collision with a Smagorinsky sub-grid model, half-way bounce-back walls,
// fixed-velocity inlet (left), zero-gradient outlet (right), periodic top/bottom.
// Forces on the body come from the momentum-exchange method.
import { NX, NY, N } from '../config.js';

export const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
export const WT = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const CS2 = 0.01;                       // Smagorinsky constant squared (Cs = 0.1)

// All solver state lives here so other modules can read it.
export const sim = {
  f: new Float32Array(9 * N),           // distributions (current)
  g: new Float32Array(9 * N),           // distributions (next step)
  rho: new Float32Array(N),
  ux: new Float32Array(N),
  uy: new Float32Array(N),
  solid: new Uint8Array(N),
  uIn: 0.1,                             // inlet speed (lattice units)
  nu: 0.012,                            // kinematic viscosity (lattice units)
  refLen: 1,                            // reference length for coefficients (cells)
  steps: 0,
  shapeStep: 0,                         // step at which the shape last changed
  clAvg: 0, cdAvg: 0,                   // time-averaged coefficients
  hist: [],                             // [clAvg, cdAvg] samples for the chart
  blown: false                          // true if the run went unstable
};

const P = new Float64Array(9);          // scratch: post-collision populations

/** (Re)allocate every field for the current grid size. */
export function allocate() {
  sim.f = new Float32Array(9 * N); sim.g = new Float32Array(9 * N);
  sim.rho = new Float32Array(N); sim.ux = new Float32Array(N); sim.uy = new Float32Array(N);
  sim.solid = new Uint8Array(N);
}

/* ---------- time-averaged coefficients ----------
 * At these Reynolds numbers the wing sheds vortices, so lift swings up and down with a
 * period of roughly 3 × NX steps. C_L and C_D are therefore a plain average over the last
 * 6 × NX steps (about two swings), and the first 3 × NX steps after a start or a shape
 * change are treated as start-up and left out of it.
 */
const RING = 8192;
const ringCl = new Float64Array(RING), ringCd = new Float64Array(RING);
let ringN = 0, ringI = 0, sumCl = 0, sumCd = 0;
const avgWindow = () => Math.min(RING, 6 * NX);
export const settleSteps = () => 3 * NX;

function resetAverages() { ringN = ringI = 0; sumCl = sumCd = 0; }

/** Fraction of the averaging window filled since the flow settled (0 while still settling). */
export function averageProgress() {
  return sim.steps - sim.shapeStep < settleSteps() ? 0 : ringN / avgWindow();
}

/**
 * Turn one step's body force into C_L / C_D and update the averages.
 * Shared by the CPU and GPU solvers.
 */
export function recordForces(Fx, Fy) {
  sim.steps++;
  const dyn = 0.5 * sim.uIn * sim.uIn * sim.refLen;
  const cd = Fx / dyn, cl = -Fy / dyn;                            // y grows downward, so lift = -Fy
  if (sim.steps - sim.shapeStep === settleSteps()) resetAverages();   // drop the start-up transient
  const W = avgWindow();
  if (ringN === W) { sumCl -= ringCl[ringI]; sumCd -= ringCd[ringI]; } else ringN++;
  ringCl[ringI] = cl; ringCd[ringI] = cd; sumCl += cl; sumCd += cd;
  ringI = (ringI + 1) % W;
  sim.clAvg = sumCl / ringN; sim.cdAvg = sumCd / ringN;
  sim.settled = sim.steps - sim.shapeStep >= settleSteps();
  if (sim.steps % 25 === 0) { sim.hist.push([sim.clAvg, sim.cdAvg]); if (sim.hist.length > 300) sim.hist.shift(); }
  if (!isFinite(Fx) || Math.abs(Fx) > 1e4 * (N / 64000)) sim.blown = true;
}

export function feq(i, r, u, v) {
  const eu = EX[i] * u + EY[i] * v;
  return WT[i] * r * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * (u * u + v * v));
}

/** Reset the whole field to uniform flow at the inlet speed. */
export function initFlow() {
  const { f, rho, ux, uy, solid, uIn } = sim;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const k = y * NX + x;
    const u = solid[k] ? 0 : uIn;
    const v = solid[k] ? 0 : uIn * 0.03 * Math.sin(2 * Math.PI * x / NX);   // tiny nudge to break symmetry
    for (let i = 0; i < 9; i++) f[i * N + k] = feq(i, 1, u, v);
    rho[k] = 1; ux[k] = u; uy[k] = v;
  }
  sim.steps = 0; sim.shapeStep = 0; sim.clAvg = sim.cdAvg = 0; sim.hist.length = 0; sim.blown = false; sim.settled = false;
  resetAverages();
}

/**
 * Called after sim.solid changed while running. Cells that were solid and are
 * now open start as still air; the flow carries on everywhere else.
 * @param {Uint8Array} oldSolid copy of sim.solid from before the change
 */
export function solidChanged(oldSolid) {
  const { f, rho, ux, uy, solid } = sim;
  for (let k = 0; k < N; k++) {
    if (oldSolid[k] && !solid[k]) {
      for (let i = 0; i < 9; i++) f[i * N + k] = WT[i];
      rho[k] = 1; ux[k] = uy[k] = 0;
    } else if (solid[k]) { ux[k] = uy[k] = 0; }
  }
  sim.shapeStep = sim.steps; sim.settled = false;
  resetAverages();
}

/** Advance the simulation by one time step. */
export function step() {
  const { f, g, rho, ux, uy, solid, uIn, nu } = sim;
  const tau0 = 3 * nu + 0.5, C = 18 * Math.SQRT2 * CS2;
  let Fx = 0, Fy = 0;
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const k = y * NX + x;
      if (solid[k]) continue;
      const f0 = f[k], f1 = f[N + k], f2 = f[2 * N + k], f3 = f[3 * N + k], f4 = f[4 * N + k],
            f5 = f[5 * N + k], f6 = f[6 * N + k], f7 = f[7 * N + k], f8 = f[8 * N + k];
      const r = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
      const u = (f1 - f3 + f5 - f6 - f7 + f8) / r;
      const v = (f2 - f4 + f5 + f6 - f7 - f8) / r;
      rho[k] = r; ux[k] = u; uy[k] = v;
      // equilibrium
      const uu = 1.5 * (u * u + v * v), r9 = r / 9, r36 = r / 36;
      const a5 = u + v, a6 = v - u;
      const e0 = 4 / 9 * r * (1 - uu);
      const e1 = r9 * (1 + 3 * u + 4.5 * u * u - uu);
      const e2 = r9 * (1 + 3 * v + 4.5 * v * v - uu);
      const e3 = r9 * (1 - 3 * u + 4.5 * u * u - uu);
      const e4 = r9 * (1 - 3 * v + 4.5 * v * v - uu);
      const e5 = r36 * (1 + 3 * a5 + 4.5 * a5 * a5 - uu);
      const e6 = r36 * (1 + 3 * a6 + 4.5 * a6 * a6 - uu);
      const e7 = r36 * (1 - 3 * a5 + 4.5 * a5 * a5 - uu);
      const e8 = r36 * (1 - 3 * a6 + 4.5 * a6 * a6 - uu);
      // non-equilibrium stress -> eddy viscosity (Smagorinsky)
      const d1 = f1 - e1, d2 = f2 - e2, d3 = f3 - e3, d4 = f4 - e4, d5 = f5 - e5, d6 = f6 - e6, d7 = f7 - e7, d8 = f8 - e8;
      const pxx = d1 + d3 + d5 + d6 + d7 + d8, pyy = d2 + d4 + d5 + d6 + d7 + d8, pxy = d5 - d6 + d7 - d8;
      const Q = Math.sqrt(pxx * pxx + pyy * pyy + 2 * pxy * pxy);
      const om = 1 / (0.5 * (tau0 + Math.sqrt(tau0 * tau0 + C * Q / r)));
      // collide
      P[0] = f0 + om * (e0 - f0); P[1] = f1 + om * (e1 - f1); P[2] = f2 + om * (e2 - f2);
      P[3] = f3 + om * (e3 - f3); P[4] = f4 + om * (e4 - f4); P[5] = f5 + om * (e5 - f5);
      P[6] = f6 + om * (e6 - f6); P[7] = f7 + om * (e7 - f7); P[8] = f8 + om * (e8 - f8);
      // stream with bounce-back + momentum exchange
      for (let i = 0; i < 9; i++) {
        const xn = x + EX[i];
        if (xn < 0 || xn >= NX) continue;
        let yn = y + EY[i]; if (yn < 0) yn = NY - 1; else if (yn >= NY) yn = 0;
        const kn = yn * NX + xn;
        if (solid[kn]) { g[OPP[i] * N + k] = P[i]; Fx += 2 * P[i] * EX[i]; Fy += 2 * P[i] * EY[i]; }
        else g[i * N + kn] = P[i];
      }
    }
  }
  // inlet (fixed velocity) and outlet (zero gradient)
  for (let y = 0; y < NY; y++) {
    const k = y * NX, ko = k + NX - 1;
    for (let i = 0; i < 9; i++) { g[i * N + k] = feq(i, 1, uIn, 0); g[i * N + ko] = g[i * N + ko - 1]; }
  }
  sim.f = g; sim.g = f;
  recordForces(Fx, Fy);
}
