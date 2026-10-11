// "Famous aircraft" picker on the Wing tab.
import { $ } from '../dom.js';
import { AIRCRAFT } from '../data/aircraft.js';

const sliderCode = () => $('m').value + $('p').value + String($('t').value).padStart(2, '0');

// NACA "2412" -> slider values. A zero camber position is shown as 40% (it has no effect).
function applyNaca(naca) {
  $('m').value = naca[0];
  $('p').value = naca[1] === '0' ? 4 : naca[1];
  $('t').value = +naca.slice(2);
  ['m', 'p', 't'].forEach(id => $(id).dispatchEvent(new Event('input')));
}

function showInfo(ac, sec) {
  const info = $('aircraftInfo');
  if (!ac) { info.hidden = true; return; }
  const where = sec.part === 'Wing' ? '' : ` at the wing ${sec.part.toLowerCase()}`;
  const note = sec.note ? ` (${sec.note})` : '';
  info.innerHTML = `<b>${ac.name}</b> · ${ac.role}<br>NACA ${sec.naca}${where}${note}. ${ac.about}`;
  info.hidden = false;
}

export function initAircraft() {
  const sel = $('aircraftSel');
  AIRCRAFT.forEach((ac, i) => {
    if (ac.sections.length === 1) {
      sel.add(new Option(`${ac.name} — NACA ${ac.sections[0].naca}`, `${i}:0`));
    } else {
      const g = document.createElement('optgroup'); g.label = ac.name;
      ac.sections.forEach((s, j) => g.appendChild(new Option(`${ac.name} — ${s.part.toLowerCase()} (NACA ${s.naca})`, `${i}:${j}`)));
      sel.appendChild(g);
    }
  });

  let chosen = null;   // { ac, sec } currently loaded
  sel.addEventListener('change', () => {
    if (!sel.value) { chosen = null; showInfo(null); return; }
    const [i, j] = sel.value.split(':').map(Number);
    chosen = { ac: AIRCRAFT[i], sec: AIRCRAFT[i].sections[j] };
    applyNaca(chosen.sec.naca);
    showInfo(chosen.ac, chosen.sec);
  });

  // Moving camber/position/thickness away from the loaded section clears the selection.
  ['m', 'p', 't'].forEach(id => $(id).addEventListener('input', () => {
    if (!chosen) return;
    const n = chosen.sec.naca, code = sliderCode();
    const same = code === n || (n[0] === '0' && code[0] === '0' && code.slice(2) === n.slice(2));
    if (!same) { chosen = null; sel.value = ''; showInfo(null); }
  }));
}
