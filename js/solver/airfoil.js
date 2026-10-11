// NACA 4-digit airfoil geometry.
import { NX, NY } from '../config.js';

/**
 * Outline of a NACA 4-digit section in grid coordinates.
 * @param {number} m  max camber (fraction of chord, e.g. 0.02)
 * @param {number} p  position of max camber (fraction of chord, e.g. 0.4)
 * @param {number} t  max thickness (fraction of chord, e.g. 0.12)
 * @param {number} aoaDeg angle of attack in degrees (positive = nose up)
 * @param {number} c  chord length in grid cells
 * @returns {Array<[number, number]>} closed polygon, upper surface then lower
 */
export function airfoilPoly(m, p, t, aoaDeg, c) {
  const n = 120, up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 * (1 - Math.cos(Math.PI * i / n));            // cosine spacing
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    let yc = 0, dy = 0;
    if (m > 0 && p > 0) {
      if (x < p) { yc = m / (p * p) * (2 * p * x - x * x); dy = 2 * m / (p * p) * (p - x); }
      else { yc = m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x); dy = 2 * m / ((1 - p) ** 2) * (p - x); }
    }
    const th = Math.atan(dy);
    up.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lo.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  const pts = up.concat(lo.reverse());
  const a = aoaDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const cx = NX * 0.3, cy = NY * 0.5;                            // quarter-chord pivot
  return pts.map(([x, y]) => {
    const X = (x - 0.25) * c, Y = y * c;
    return [cx + X * ca + Y * sa, cy - (-X * sa + Y * ca)];
  });
}
