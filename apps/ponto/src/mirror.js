import { state } from './store.js';
import { HM, WDS, MESES, F, meta, calcWorkClosed, toast, esc } from './utils.js';

export function buildMirrorMonths() {
  const hist   = state.HIST[state.cu] || [];
  const months = new Set();
  const now    = new Date();
  months.add(`${now.getFullYear()}-${F(now.getMonth() + 1)}`);
  hist.forEach(d => months.add(d.date.slice(0, 7)));
  const sorted = [...months].sort((a, b) => b.localeCompare(a));
  const sel    = document.getElementById('msel');
  const cur    = sel.value;
  sel.innerHTML = sorted.map(m => {
    const [y, mo] = m.split('-');
    const label   = MESES[parseInt(mo) - 1];
    return `<option value="${m}">${label.charAt(0).toUpperCase() + label.slice(1)} ${y}</option>`;
  }).join('');
  if (sorted.includes(cur)) sel.value = cur;
}

export function renderMirror() {
  const hist = state.HIST[state.cu] || [];
  const msel = document.getElementById('msel').value;
  const days = hist.filter(d => d.date.startsWith(msel)).sort((a, b) => b.date.localeCompare(a.date));

  if (!days.length) {
    document.getElementById('mlist').innerHTML = '<div class="card"><div class="empty"><i class="fa-regular fa-calendar"></i>Sem registros neste período</div></div>';
    document.getElementById('mtotals').innerHTML = '';
    return;
  }

  let tw = 0, te = 0, td = 0;
  const jm = state.EMP[state.cu].j * 60;

  document.getElementById('mlist').innerHTML = '<div class="rl">' + days.map(d => {
    const dt = new Date(d.date + 'T12:00:00');
    const wk = calcWorkClosed(d.records);
    tw += wk;
    const sld = wk - jm;
    if (sld > 0) te += sld; else if (sld < 0) td += Math.abs(sld);
    const ent = d.records.find(p => p.type === 'entry');
    const ex  = d.records.find(p => p.type === 'exit');
    return `<div class="ri"><div><div class="ri-name">${WDS[dt.getDay()]} ${d.date.split('-').reverse().slice(0, 2).join('/')}</div><div class="ri-sub"><i class="fa-solid fa-right-to-bracket" style="font-size:11px"></i> ${ent ? ent.time : '--:--'} &nbsp;<i class="fa-solid fa-right-from-bracket" style="font-size:11px"></i> ${ex ? ex.time : '--:--'}</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:600">${HM(wk)}</div>${wk > 0 ? `<div style="font-size:12px;font-weight:600" class="${sld >= 0 ? 'pos' : 'neg'}">${sld >= 0 ? '+' : ''}${HM(sld)}</div>` : ''}</div></div>`;
  }).join('') + '</div>';

  document.getElementById('mtotals').innerHTML = `<div class="card" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:.875rem"><div><div class="ml">Total trabalhado</div><div style="font-size:17px;font-weight:700">${HM(tw)}</div></div><div><div class="ml">Extras</div><div style="font-size:17px;font-weight:700" class="pos">+${HM(te)}</div></div><div><div class="ml">Devidas</div><div style="font-size:17px;font-weight:700" class="neg">${HM(td)}</div></div></div>`;
}

export function printMirror() {
  const msel = document.getElementById('msel').value;
  const [year, month] = msel.split('-');
  const monthName = MESES[parseInt(month) - 1];
  const hist = state.HIST[state.cu] || [];
  const days = hist.filter(d => d.date.startsWith(msel)).sort((a, b) => a.date.localeCompare(b.date));
  const e = state.EMP[state.cu];
  const jm = e.j * 60;
  let tw = 0, te = 0, td = 0;

  const rows = days.map(d => {
    const dt = new Date(d.date + 'T12:00:00');
    const wk = calcWorkClosed(d.records);
    tw += wk;
    const sld = wk - jm;
    if (sld > 0) te += sld; else if (sld < 0) td += Math.abs(sld);
    const ent = d.records.find(p => p.type === 'entry');
    const brk = d.records.find(p => p.type === 'break');
    const ret = d.records.find(p => p.type === 'return');
    const ex  = d.records.find(p => p.type === 'exit');
    const sc  = sld > 0 ? '#1D6B4A' : sld < 0 ? '#A32D2D' : '#555';
    return `<tr><td>${WDS[dt.getDay()]} ${d.date.split('-').reverse().slice(0, 2).join('/')}</td><td>${ent ? ent.time : '--'}</td><td>${brk ? brk.time : '--'}</td><td>${ret ? ret.time : '--'}</td><td>${ex ? ex.time : '--'}</td><td>${HM(wk)}</td><td style="color:${sc};font-weight:700">${wk > 0 ? (sld >= 0 ? '+' : '') + HM(sld) : '--'}</td></tr>`;
  }).join('');

  const metaH = meta(e);
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Espelho — ${e.name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a;font-size:13px}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:16px;border-bottom:2.5px solid #2d5a1b}
.brand .v{font-size:24px;font-weight:800;color:#2d5a1b;line-height:1}.brand .i{font-size:11px;letter-spacing:3px;color:#7a1a1a}
.title h2{font-size:16px;font-weight:700;text-align:right}.title p{font-size:12px;color:#666;text-align:right}
.info{display:flex;gap:24px;margin-bottom:20px;font-size:13px;background:#f5f4f0;padding:12px 16px;border-radius:8px}
.info span{color:#666}.info strong{color:#1a1a1a}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#2d5a1b;color:#fff;padding:9px 10px;text-align:left;font-size:12px;font-weight:700;letter-spacing:.3px}
td{padding:8px 10px;border-bottom:1px solid #e8e6df}tr:nth-child(even) td{background:#f0f5ec}
.tots{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px}
.tc{background:#f5f4f0;border:1px solid #e8e6df;border-radius:7px;padding:13px 16px}
.tc .l{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;font-weight:600}
.tc .v{font-size:20px;font-weight:800}
.ftr{margin-top:32px;padding-top:12px;border-top:1px solid #e8e6df;font-size:11px;color:#999;display:flex;justify-content:space-between}
@media print{button{display:none!important}}
</style></head><body>
<div class="hdr"><div class="brand"><div class="v">Verde</div><div class="i">interior</div></div>
<div class="title"><h2>Espelho de Ponto — ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}</h2><p>Emitido em ${new Date().toLocaleDateString('pt-BR')}</p></div></div>
<div class="info"><div><span>Colaborador: </span><strong>${esc(e.name)}</strong></div><div><span>Cargo: </span><strong>${esc(e.cargo)}</strong></div><div><span>Contrato: </span><strong>${esc(e.c)}</strong></div><div><span>Jornada: </span><strong>${e.j}h/dia</strong></div><div><span>Meta: </span><strong>${metaH}h</strong></div></div>
<table><thead><tr><th>Data</th><th>Entrada</th><th>Intervalo</th><th>Retorno</th><th>Saída</th><th>Trabalhadas</th><th>Saldo</th></tr></thead>
<tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">Sem registros neste período</td></tr>'}</tbody></table>
<div class="tots">
<div class="tc"><div class="l">Total trabalhado</div><div class="v">${HM(tw)}</div></div>
<div class="tc"><div class="l">Horas extras</div><div class="v" style="color:#1D6B4A">+${HM(te)}</div></div>
<div class="tc"><div class="l">Horas devidas</div><div class="v" style="color:#A32D2D">${HM(td)}</div></div>
</div>
<div class="ftr"><span>Verde Interior — Sistema de Ponto</span><span>Assinatura colaborador: _______________________</span></div>
<script>window.onload=()=>window.print();</` + `</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=920,height=720');
  if (w) { w.document.write(html); w.document.close(); }
  else toast('Permita pop-ups para imprimir', false);
}
