// Thin-airfoil theory: the textbook estimate of a wing section's lift at real flight
// Reynolds numbers (millions), before the stall. C_L = 2π(α − α₀), where α₀ is the
// zero-lift angle set by the camber line. For a NACA 2412 this gives α₀ ≈ −2.1° and
// C_L ≈ 0.78 at 5°, close to wind-tunnel data.

export const CL_MAX = 1.6;        // typical maximum for NACA 4-digit sections at flight Reynolds numbers
const STALLED = 0.65;             // fraction of CL_MAX left once the wing has stalled (rough)

/** Zero-lift angle (radians) of a NACA 4-digit mean line. m, p as fractions of chord. */
export function zeroLiftAngle(m, p) {
  if (m <= 0 || p <= 0) return 0;
  const n = 2000, dθ = Math.PI / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const θ = (i + 0.5) * dθ, x = 0.5 * (1 - Math.cos(θ));
    const slope = x < p ? 2 * m / (p * p) * (p - x) : 2 * m / ((1 - p) ** 2) * (p - x);
    sum += slope * (Math.cos(θ) - 1) * dθ;
  }
  return -sum / Math.PI;
}

/**
 * Section lift coefficient at angle of attack aoaDeg.
 * Past the stall (where the straight line would exceed CL_MAX) the flow separates and lift
 * falls away; that is modelled crudely as a drop to STALLED × CL_MAX.
 * @returns {{cl: number, stalled: boolean}}
 */
export function thinAirfoilCl(m, p, aoaDeg) {
  const cl = 2 * Math.PI * (aoaDeg * Math.PI / 180 - zeroLiftAngle(m, p));
  if (Math.abs(cl) <= CL_MAX) return { cl, stalled: false };
  return { cl: Math.sign(cl) * STALLED * CL_MAX, stalled: true };
}
