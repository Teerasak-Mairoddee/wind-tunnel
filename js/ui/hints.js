// "?" buttons and their pop-up explanations.
import { $ } from '../dom.js';

// Keyed by the id of the control (or label / result) the button sits next to.
const HINTS = {
  lblNaca: ['NACA presets', 'Classic wing sections. In “2412” the 2 is max camber (2%), the 4 is where it sits (40% back) and 12 is thickness (12% of chord). 0012 is symmetric and makes no lift at 0°; 4415 and 6409 are strongly curved high-lift sections.'],
  m: ['Max camber', 'How curved the wing is. More camber gives more lift at the same angle, and lift even at 0°, but adds drag and a nose-down twisting force. 0% is a symmetric wing.'],
  p: ['Camber position', 'Where the highest point of the curve sits along the wing. Forward (20–30%) gives a gentler stall; further back loads up the rear of the wing and increases the nose-down twisting force.'],
  t: ['Thickness', 'Thickest point as a % of chord. Thicker wings are stronger, stall more gently and reach higher max lift, but cost more drag. Thin wings are slippery but stall suddenly.'],
  aoa: ['Angle of attack', 'Tilt of the wing into the airflow. Lift rises roughly in step with angle until the stall (around 12–16° on real wings), when the flow peels off the top, lift drops and drag jumps. Negative angles push the wing down.'],
  chord: ['Chord length', 'How big the wing is inside the tunnel. Bigger means a smoother shape and a higher Reynolds number, but the tunnel walls crowd the flow more, which can inflate lift and drag. It does not change the real wing’s size.'],
  lblTools: ['Drawing tools', 'Draw adds solid material, Erase removes it, Clear empties the tunnel. Every painted pixel becomes a wall the air must go around.'],
  brush: ['Brush size', 'Width of your pen in grid cells. Use small sizes for sharp edges and trailing edges. Rough, jagged outlines add drag.'],
  lblShapes: ['Shape presets', 'Reference shapes with well-known behaviour. A cylinder sheds a swirling wake (C<sub>D</sub> around 1–1.5), a flat plate facing the wind has very high drag (around 2), and a wedge pointing into the wind is much more streamlined.'],
  sCl: ['Lift coefficient', 'Lift force with size and speed divided out, so shapes can be compared fairly. Positive means upward. Real wings cruise around 0.3–0.6 and peak near 1.2–1.6 before stalling.'],
  sCd: ['Drag coefficient', 'Drag force with size and speed divided out. Lower is better. Streamlined wings sit near 0.01–0.05 at real flight speeds; this low-Reynolds sim shows higher values.'],
  sLD: ['Lift-to-drag ratio', 'How much lift you get for each unit of drag. It measures efficiency: higher L/D means longer glide and less power needed. Gliders reach 40–60, small drones 8–15.'],
  sRe: ['Reynolds number', 'Ratio of the air’s momentum to its stickiness: speed × size ÷ viscosity. Real aircraft fly at millions. Low values mean thick, sluggish boundary layers, so lift reads lower and drag higher than in real life.'],
  sSteps: ['Time steps', 'How long the simulation has run. Give it a couple of thousand steps for the wake to develop and the numbers to settle.'],
  sPerf: ['Solver speed', 'Millions of grid cells updated per second. It depends on your device, not on the shape, and does not affect results.'],
  viewSel: ['View', 'Velocity: air speed, bright is fast. Faster air over the top of a wing means lower pressure there, which is lift. Vorticity: swirl, showing the wake and shed vortices. Pressure: blue is suction, orange is high pressure.'],
  particles: ['Smoke particles', 'Tracers that ride the airflow, like smoke in a real tunnel. Purely visual; they do not change the results.'],
  speed: ['Wind speed', 'Inlet speed in simulation units. Faster raises the Reynolds number (more realistic, more turbulent). Above about 0.15 the method breaks down and can go unstable. C<sub>L</sub> and C<sub>D</sub> already account for speed.'],
  visc: ['Viscosity', 'How thick or sticky the fluid is. Lower values raise the Reynolds number, giving thinner boundary layers, vortex shedding and results closer to real flight, but may go unstable. Higher values make the flow syrupy and draggy.'],
  spf: ['Steps per frame', 'Simulation steps between screen updates. Higher gets to settled results faster but the animation gets choppier. It does not change the physics.'],
  fAoa: ['Angle of attack', 'Tilts the wing in the running simulation, so you can watch lift and the verdict change live. Lift rises with angle until the stall (around 12–16° on real wings), then drops while drag jumps. Find the angle that just gives enough lift: that is your cruise angle at this speed.'],
  fMass: ['Aircraft mass', 'Total take-off mass, including battery or fuel and payload. Weight = mass × 9.81. Doubling mass needs about 41% more speed or twice the wing area.'],
  fSpan: ['Wingspan', 'Tip-to-tip length. A longer span adds area and raises aspect ratio, which reduces tip losses, so lift grows faster than span alone suggests.'],
  fChord: ['Wing chord', 'Front-to-back width of the wing. More chord adds area (more lift) but lowers aspect ratio, so more lift is lost at the tips.'],
  fSpeed: ['Airspeed', 'Speed of the air over the wing. Lift grows with speed squared: double the speed gives four times the lift. This is usually the easiest lever.'],
  fAlt: ['Altitude', 'Air gets thinner higher up, so the same wing makes less lift. At 3,000 m the air is about 26% thinner, so you need about 16% more speed.'],
  fSrc: ['C<sub>L</sub> source', 'Live simulation uses the tunnel’s C<sub>L</sub>, which reads low because of the low Reynolds number. My own value lets you enter a figure from published airfoil data for a realistic answer.'],
  fOwn: ['Your airfoil C<sub>L</sub>', 'The 2D lift coefficient of your section at your angle of attack, from airfoil data (e.g. airfoiltools.com). Typical values are 0.2–1.4. The 3D tip-loss correction is applied for you.'],
  lblPlan: ['Top view', 'Your wing seen from above, drawn to scale from the span and chord you entered. The fuselage grows with aircraft mass (its length follows the cube root of mass, matching real aircraft from RC planes to light aircraft), so a heavy plane on a small wing looks it. Long, slim wings (high aspect ratio) lose less lift at the tips and glide further; short, wide wings are stronger and roll faster.'],
  fCl3: ['Wing C<sub>L</sub> (3D)', 'The airfoil’s C<sub>L</sub> reduced for air spilling around the wingtips: C<sub>L</sub> × AR / (AR + 2). Longer, slimmer wings lose less.'],
  fArea: ['Wing area', 'Span × chord. Lift scales directly with area, so twice the area gives twice the lift at the same speed.'],
  fAR: ['Aspect ratio', 'Span ÷ chord, a measure of how long and slim the wing is. Gliders are 20+, light aircraft about 7, small RC planes 5–8. Higher means less tip loss and less induced drag.'],
  fVmin: ['Minimum flying speed', 'The slowest speed at which lift equals weight with this C<sub>L</sub>. Below it the plane sinks. Real planes need a margin above this to stay clear of the stall.']
};

let tip, tipBtn = null;

function closeTip() {
  tip.hidden = true;
  if (tipBtn) tipBtn.setAttribute('aria-expanded', 'false');
  tipBtn = null;
}

function openTip(btn, key) {
  if (tipBtn === btn) { closeTip(); return; }
  closeTip();
  const [title, body] = HINTS[key];
  tip.innerHTML = `<b>${title}</b>${body}`; tip.hidden = false;
  tipBtn = btn; btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = Math.min(Math.max(16, r.left + r.width / 2 - tw / 2), innerWidth - tw - 16);
  let top = r.bottom + 8; if (top + th > innerHeight - 8) top = Math.max(8, r.top - th - 8);
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}

// Where the "?" goes for a given id: the control's label, a section label, or a stat tile's caption.
function hintAnchor(id) {
  const el = $(id);
  if (el.classList.contains('mini-label')) return el;
  if (el.tagName === 'B') return el.previousElementSibling;
  return document.querySelector(`label[for="${id}"]`) || el.closest('label') || el.closest('.row').querySelector('label');
}

export function initHints() {
  tip = document.createElement('div');
  tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);

  Object.keys(HINTS).forEach(key => {
    const anchor = hintAnchor(key), btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'hint-btn'; btn.textContent = '?';
    btn.setAttribute('aria-label', 'What does ' + HINTS[key][0].replace(/<[^>]+>/g, '') + ' do?');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openTip(btn, key); });
    const out = anchor.querySelector('output');
    out ? anchor.insertBefore(btn, out) : anchor.appendChild(btn);
  });

  document.addEventListener('pointerdown', e => { if (tipBtn && !tip.contains(e.target) && !tipBtn.contains(e.target)) closeTip(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTip(); });
  window.addEventListener('scroll', closeTip, { passive: true });
  window.addEventListener('resize', closeTip);
}
