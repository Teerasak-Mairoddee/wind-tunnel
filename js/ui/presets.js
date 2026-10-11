// Presets dropdown on the Wing tab: classic NACA sections and real aircraft wings.
import { $ } from '../dom.js';
import { PRESETS } from '../data/presets.js';

const sliderCode = () => $('m').value + $('p').value + String($('t').value).padStart(2, '0');

// Symmetric sections ignore camber position, so "0012" matches 0 camber at any position.
const matches = (naca, code) => naca === code || (naca[0] === '0' && code[0] === '0' && naca.slice(2) === code.slice(2));

// "2412" -> slider values. A zero camber position is shown as 40% (it has no effect).
function applyNaca(naca) {
  $('m').value = naca[0];
  $('p').value = naca[1] === '0' ? 4 : naca[1];
  $('t').value = +naca.slice(2);
  ['m', 'p', 't'].forEach(id => $(id).dispatchEvent(new Event('input')));
}

function showInfo(p, filled = false) {
  const info = $('presetInfo');
  if (!p) { info.hidden = true; return; }
  const where = p.part ? ` at the wing ${p.part}` : '';
  const note = p.note ? ` (${p.note})` : '';
  const line2 = p.title.startsWith('NACA') ? p.about : `NACA ${p.naca}${where}${note}. ${p.about}`;
  const size = p.fly && filled
    ? `<br>Will it fly? set to the ${p.fly.variant}: ${p.fly.span.toFixed(2)} m span, ${(p.fly.area / p.fly.span).toFixed(2)} m mean chord, ${p.fly.mass.toLocaleString()} kg, ${p.fly.length} m long, cruising at ${p.fly.cruise} m/s (${p.fly.cruiseText}).`
    : '';
  info.innerHTML = `<b>${p.title}</b> · ${p.role}<br>${line2}${size}`;
  info.hidden = false;
}

// Put the aircraft's real size and cruise speed into the "Will it fly?" inputs (input events save and redraw).
function fillFly({ span, area, mass, cruise, length }) {
  const set = (id, v) => { const el = $(id); if (!el) return; el.value = v; el.dispatchEvent(new Event('input')); };
  set('fMass', mass);
  set('fSpan', span);
  set('fChord', +(area / span).toFixed(2));
  set('fSpeed', cruise);
  set('fLen', length);
  set('fSrc', 'theory');            // real aircraft fly at Reynolds numbers far above the tunnel's
}

export function initPresets() {
  const sel = $('presetSel');
  PRESETS.forEach((p, i) => sel.add(new Option(p.label, String(i))));

  sel.addEventListener('change', () => {
    if (!sel.value) { showInfo(null); return; }
    const p = PRESETS[+sel.value];
    applyNaca(p.naca);
    if (p.fly) fillFly(p.fly);
    showInfo(p, true);
  });

  // Keep the dropdown in step with the sliders: stay on the chosen preset while it
  // still matches, otherwise show a matching plain NACA preset, or "Custom".
  // Aircraft are never selected automatically: only an explicit pick should load
  // their size and speed, and an auto-selected aircraft could not be re-picked to fill them.
  const sync = () => {
    const code = sliderCode(), cur = sel.value ? PRESETS[+sel.value] : null;
    if (cur && matches(cur.naca, code)) return;
    const i = PRESETS.findIndex(p => !p.fly && matches(p.naca, code));
    sel.value = i < 0 ? '' : String(i);
    showInfo(i < 0 ? null : PRESETS[i]);
  };
  ['m', 'p', 't'].forEach(id => $(id).addEventListener('input', sync));
  sync();
}
