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

function showInfo(p) {
  const info = $('presetInfo');
  if (!p) { info.hidden = true; return; }
  const where = p.part ? ` at the wing ${p.part}` : '';
  const note = p.note ? ` (${p.note})` : '';
  const line2 = p.title.startsWith('NACA') ? p.about : `NACA ${p.naca}${where}${note}. ${p.about}`;
  info.innerHTML = `<b>${p.title}</b> · ${p.role}<br>${line2}`;
  info.hidden = false;
}

export function initPresets() {
  const sel = $('presetSel');
  PRESETS.forEach((p, i) => sel.add(new Option(p.label, String(i))));

  sel.addEventListener('change', () => {
    if (!sel.value) { showInfo(null); return; }
    const p = PRESETS[+sel.value];
    applyNaca(p.naca);
    showInfo(p);
  });

  // Keep the dropdown in step with the sliders: stay on the chosen preset while it
  // still matches, otherwise show the first matching preset, or "Custom".
  const sync = () => {
    const code = sliderCode(), cur = sel.value ? PRESETS[+sel.value] : null;
    if (cur && matches(cur.naca, code)) return;
    const i = PRESETS.findIndex(p => matches(p.naca, code));
    sel.value = i < 0 ? '' : String(i);
    showInfo(i < 0 ? null : PRESETS[i]);
  };
  ['m', 'p', 't'].forEach(id => $(id).addEventListener('input', sync));
  sync();
}
