export const F = n => n < 10 ? '0' + n : String(n);
export const HM = m => { const s = m < 0 ? '-' : ''; const v = Math.abs(Math.round(m)); return s + Math.floor(v / 60) + 'h' + F(v % 60); };
export const HMh = h => HM(Math.round(h * 60));

export const TODAY = new Date();
export const TKEY = `${TODAY.getFullYear()}-${F(TODAY.getMonth() + 1)}-${F(TODAY.getDate())}`;
export const WDS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const meta = e => e.j === 8 ? 176 : e.j === 6 ? 132 : e.j * 22;

export const TM = {
  entry:  { lbl: 'Entrada',   cls: 'rb-e' },
  break:  { lbl: 'Intervalo', cls: 'rb-b' },
  return: { lbl: 'Retorno',   cls: 'rb-r' },
  exit:   { lbl: 'Saída',     cls: 'rb-x' },
};

export function calcWork(recs) {
  let t = 0, e = null;
  for (const p of recs) {
    const [h, m] = p.time.split(':').map(Number);
    const min = h * 60 + m;
    if (p.type === 'entry' || p.type === 'return') e = min;
    if ((p.type === 'break' || p.type === 'exit') && e !== null) { t += min - e; e = null; }
  }
  if (e !== null) { const n = new Date(); t += n.getHours() * 60 + n.getMinutes() - e; }
  return t;
}

export function calcWorkClosed(recs) {
  let t = 0, e = null;
  for (const p of recs) {
    const [h, m] = p.time.split(':').map(Number);
    const min = h * 60 + m;
    if (p.type === 'entry' || p.type === 'return') e = min;
    if ((p.type === 'break' || p.type === 'exit') && e !== null) { t += min - e; e = null; }
  }
  return t;
}

export function getStatus(ps, i) {
  const p = ps[i] || [];
  if (!p.length) return { s: 'out', lbl: 'Sem registro hoje', css: 'so' };
  const l = p[p.length - 1];
  if (l.type === 'entry' || l.type === 'return') return { s: 'in',   lbl: 'Trabalhando',           css: 'si' };
  if (l.type === 'break')                        return { s: 'brk',  lbl: 'Em intervalo',           css: 'sb' };
  if (l.type === 'exit')                         return { s: 'done', lbl: 'Expediente encerrado',   css: 'sd' };
  return { s: 'out', lbl: 'Sem registro', css: 'so' };
}

export function getNext(ps, i) {
  const s = getStatus(ps, i).s;
  if (s === 'out' || s === 'done') return { type: 'entry',  lbl: 'Registrar Entrada' };
  if (s === 'in')                  return { type: 'break',  lbl: 'Iniciar Intervalo' };
  if (s === 'brk')                 return { type: 'return', lbl: 'Retornar do Intervalo' };
  return { type: 'entry', lbl: 'Registrar' };
}

export function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = ok ? '#1a1a1a' : '#A32D2D';
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2300);
}

export function fmtSize(b) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return Math.round(b / 1024) + 'KB';
  return (b / 1048576).toFixed(1) + 'MB';
}

export function classify(f) {
  if (f.type.startsWith('image/')) return 'img';
  if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) return 'pdf';
  return 'doc';
}
