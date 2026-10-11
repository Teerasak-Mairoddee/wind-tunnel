// "Will it fly?" panel: lift equation, 3D correction, verdict and the top-view drawing.
import { $, fmt, bindOut } from '../dom.js';
import { app } from '../state.js';
import { sim } from '../solver/lbm.js';
import { genAirfoil } from '../shape.js';

const G = 9.81;
const FLY_IDS = ['fMass', 'fSpan', 'fChord', 'fSpeed', 'fAlt', 'fSrc', 'fOwn'];
const STORE_KEY = 'wt-fly';

function setVerdict(cls, text) { const v = $('verdict'); v.className = 'verdict ' + cls; v.textContent = text; }

export function updateFly() {
  const num = id => parseFloat($(id).value);
  const own = $('fSrc').value === 'own';
  $('fOwnWrap').hidden = !own;
  const m = num('fMass'), b = num('fSpan'), c = num('fChord'), V = num('fSpeed'), rhoAir = num('fAlt');
  const cl2 = own ? num('fOwn') : sim.clAvg;
  if (![m, b, c, V, cl2].every(isFinite) || m <= 0 || b <= 0 || c <= 0 || V <= 0) {
    setVerdict('', 'Check inputs'); $('flySummary').textContent = 'Enter a positive mass, span, chord and speed.'; return;
  }
  drawPlanform(b, c, m);

  const S = b * c, AR = b / c, cl3 = cl2 * AR / (AR + 2);      // finite-wing (tip loss) correction
  const W = m * G, L = 0.5 * rhoAir * V * V * S * cl3;
  const vmin = cl3 > 0 ? Math.sqrt(2 * W / (rhoAir * S * cl3)) : NaN;

  $('fCl3').textContent = cl3.toFixed(3);
  $('fArea').textContent = S.toFixed(3) + ' m²';
  $('fAR').textContent = AR.toFixed(1);
  $('fVmin').textContent = isFinite(vmin) ? vmin.toFixed(1) + ' m/s' : 'none';
  $('fLift').textContent = L.toFixed(1) + ' N';
  $('fWeight').textContent = W.toFixed(1) + ' N';
  const scale = Math.max(Math.abs(L), W) * 1.15;
  $('liftFill').style.width = Math.max(0, L / scale * 100) + '%';
  $('liftFill').style.background = L >= W ? 'var(--good)' : 'var(--accent2)';
  $('wMark').style.left = (W / scale * 100) + '%';

  if (!own && sim.steps < 400) { setVerdict('', 'Settling…'); $('flySummary').textContent = 'Waiting for the flow to settle before judging.'; return; }
  if (cl3 <= 0) {
    setVerdict('bad', 'No lift');
    $('flySummary').textContent = 'This shape produces no upward force here. Increase the angle of attack or add camber.';
  } else if (L >= W) {
    setVerdict('ok', 'It flies');
    $('flySummary').textContent = `Lift is ${Math.round((L / W - 1) * 100)}% more than the weight. Level flight is possible from ${vmin.toFixed(1)} m/s upward.`;
  } else {
    setVerdict('bad', 'Not enough lift');
    $('flySummary').textContent = `Lift is ${Math.round((1 - L / W) * 100)}% short of the weight. It needs ${vmin.toFixed(1)} m/s, a larger wing or a higher angle of attack.`;
  }
}

/** Bird's-eye view: wing to scale from span & chord, fuselage sized by mass. */
function drawPlanform(b, c, mass) {
  const cv = $('planform'), W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
  const ACC = col('--accent'), TXT = col('--text'), MUT = col('--muted'), LINE = col('--line');

  // Fuselage volume scales with mass, so length and width grow with the cube root of mass.
  // Calibrated to real aircraft: 2 kg RC plane ≈ 1.2 m, 1,100 kg light aircraft ≈ 9.8 m.
  const fl = Math.max(0.95 * Math.cbrt(mass), 2.4 * c);    // never shorter than the wing root needs
  const fw = 0.11 * fl;
  const hs = 0.34 * b, hc = 0.5 * c;                         // tailplane span & chord
  const padX = 58, padT = 26, padB = 44;
  const s = Math.min((W - 2 * padX) / Math.max(b, hs, fw), (H - padT - padB) / fl);   // px per metre
  const cx = W / 2, top = padT + ((H - padT - padB) - fl * s) / 2;
  const wingLE = top + 0.28 * fl * s, tailLE = top + (fl - hc - 0.04 * fl) * s;

  // fuselage (nose up = flying toward top of screen)
  x.fillStyle = LINE; x.strokeStyle = MUT; x.lineWidth = 1;
  const r = fw * s / 2, L = fl * s;
  x.beginPath();
  x.moveTo(cx - r, top + r * 1.6);
  x.quadraticCurveTo(cx - r, top, cx, top);
  x.quadraticCurveTo(cx + r, top, cx + r, top + r * 1.6);
  x.lineTo(cx + r * 0.9, top + L * 0.62);
  x.lineTo(cx + r * 0.3, top + L);
  x.lineTo(cx - r * 0.3, top + L);
  x.lineTo(cx - r * 0.9, top + L * 0.62);
  x.closePath(); x.fill(); x.stroke();

  // tailplane + fin
  x.fillStyle = 'rgba(139,153,173,0.35)';
  x.beginPath(); x.rect(cx - hs * s / 2, tailLE, hs * s, hc * s); x.fill(); x.stroke();
  x.strokeStyle = MUT; x.lineWidth = 2;
  x.beginPath(); x.moveTo(cx, tailLE - hc * s * 0.4); x.lineTo(cx, top + L); x.stroke();

  // main wing
  const wx = cx - b * s / 2, ww = b * s, wh = Math.max(c * s, 1.5);
  x.fillStyle = ACC + '55'; x.strokeStyle = ACC; x.lineWidth = 1.5;
  x.beginPath(); x.rect(wx, wingLE, ww, wh); x.fill(); x.stroke();

  // dimension lines
  x.strokeStyle = TXT; x.fillStyle = TXT; x.lineWidth = 1; x.font = '600 12px system-ui,sans-serif';
  const tick = (x1, y1, x2, y2) => { x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); };
  const dy = wingLE - 10;                                   // span
  tick(wx, dy, wx + ww, dy); tick(wx, dy - 4, wx, dy + 4); tick(wx + ww, dy - 4, wx + ww, dy + 4);
  const spanTxt = b.toFixed(2) + ' m', tw = x.measureText(spanTxt).width, lx = cx + ww / 4 - tw / 2;
  x.fillStyle = col('--panel2'); x.fillRect(lx - 4, dy - 9, tw + 8, 16);
  x.fillStyle = TXT; x.textBaseline = 'middle'; x.fillText(spanTxt, lx, dy);
  const dx = wx + ww + 8;                                   // chord
  tick(dx, wingLE, dx, wingLE + wh); tick(dx - 4, wingLE, dx + 4, wingLE); tick(dx - 4, wingLE + wh, dx + 4, wingLE + wh);
  x.fillText(c.toFixed(2) + ' m', dx + 6, wingLE + wh / 2);
  const fx = Math.min(wx, cx - r) - 10;                     // fuselage length
  x.strokeStyle = MUT; x.fillStyle = MUT;
  tick(fx, top, fx, top + L); tick(fx - 4, top, fx + 4, top); tick(fx - 4, top + L, fx + 4, top + L);
  x.textAlign = 'right'; x.fillText(fl.toFixed(2) + ' m', fx - 6, top + L * 0.75); x.textAlign = 'left';

  // scale bar
  const target = (W * 0.22) / s, choices = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20];
  const bar = choices.reduce((a, v) => Math.abs(v - target) < Math.abs(a - target) ? v : a);
  const by = H - 16, bx = 12;
  x.strokeStyle = MUT; x.lineWidth = 2; tick(bx, by, bx + bar * s, by);
  x.lineWidth = 1; tick(bx, by - 4, bx, by + 4); tick(bx + bar * s, by - 4, bx + bar * s, by + 4);
  x.fillStyle = MUT; x.font = '11px system-ui,sans-serif'; x.fillText(bar + ' m', bx + bar * s + 6, by);

  // aspect ratio class
  const AR = b / c;
  const kind = AR < 4 ? 'stubby, agile' : AR < 8 ? 'moderate, like most aircraft' : AR < 15 ? 'efficient, long-range' : 'glider-like';
  x.textAlign = 'right'; x.fillStyle = TXT; x.font = '600 12px system-ui,sans-serif';
  x.fillText('AR ' + AR.toFixed(1) + ' · ' + kind, W - 12, by);
  x.textAlign = 'left';
}

/** Copy the editor's angle into the panel slider; disable it for drawn shapes. */
export function syncFlyAoa() {
  $('fAoa').value = $('aoa').value; $('o_fAoa').textContent = fmt.fAoa($('fAoa').value);
  const ok = app.shapeSource === 'airfoil';
  $('fAoa').disabled = !ok; $('fAoaNote').hidden = ok;
}

export function initFly() {
  try {                                                    // restore this viewer's last inputs
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    FLY_IDS.forEach(id => { if (saved[id] != null) $(id).value = saved[id]; });
  } catch (e) { /* storage unavailable */ }
  FLY_IDS.forEach(id => $(id).addEventListener('input', () => {
    updateFly();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(FLY_IDS.map(k => [k, $(k).value])))); } catch (e) { /* ignore */ }
  }));
  bindOut('fAoa', () => {                                  // tilt the wing in the running simulation
    $('aoa').value = $('fAoa').value; $('o_aoa').textContent = fmt.aoa($('aoa').value);
    genAirfoil();
  });
  window.addEventListener('resize', () => { if (!$('flyPanel').hidden) updateFly(); });
}
