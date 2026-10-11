// Small DOM helpers shared by every module.
export const $ = id => document.getElementById(id);

// How each slider's value is shown in its <output id="o_<id>">.
export const fmt = {
  m: v => v + '%', p: v => (v * 10) + '%', t: v => v + '%', aoa: v => v + '°',
  chord: v => v + '% of tunnel', brush: v => v + ' px',
  fAoa: v => v + '°', speed: v => (+v).toFixed(3), visc: v => (+v).toFixed(3), spf: v => v
};

// Keep a slider's <output> in sync and run cb on every change.
export function bindOut(id, cb) {
  const el = $(id), out = $('o_' + id);
  const upd = () => { if (out) out.textContent = fmt[id](el.value); };
  el.addEventListener('input', () => { upd(); cb && cb(); });
  upd();
}

// Overlay message on the tunnel (empty string hides it).
export function showMsg(text) {
  $('msg').textContent = text;
  $('msg').classList.toggle('show', !!text);
}
