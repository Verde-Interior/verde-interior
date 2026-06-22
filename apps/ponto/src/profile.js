import { state } from './store.js';
import { HM, HMh, meta } from './utils.js';

export function renderProfile() {
  const e = state.EMP[state.cu];
  const initials = e.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const m = meta(e);
  const pct = Math.min(100, Math.round((e.worked / m) * 100));

  document.getElementById('prof-card').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:1.25rem">
      <div class="avatar">${initials}</div>
      <div><div style="font-size:17px;font-weight:700">${e.name}</div>
      <div style="font-size:13px;color:var(--text2);margin-top:2px">${e.cargo} &nbsp;·&nbsp; <span class="bc">${e.c}</span></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;border-top:1px solid var(--border);padding-top:1.25rem">
      <div><div class="ml">Jornada diária</div><div style="font-size:15px;font-weight:700">${e.j}h / dia</div></div>
      <div><div class="ml">Meta mensal</div><div style="font-size:15px;font-weight:700">${m}h</div></div>
      <div><div class="ml">Banco de horas</div><div style="font-size:15px;font-weight:700;color:${e.bank >= 0 ? '#1D9E75' : '#E24B4A'}">${HM(e.bank)}</div></div>
      <div><div class="ml">Dias trabalhados</div><div style="font-size:15px;font-weight:700">${e.days} dias</div></div>
    </div>`;

  document.getElementById('prof-stats').innerHTML = `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:13px;color:var(--text2);font-weight:500">Progresso da meta mensal</span>
      <span style="font-size:13px;font-weight:700">${HMh(e.worked)} / ${m}h &nbsp;(${pct}%)</span>
    </div>
    <div class="bt" style="height:11px"><div class="bf" style="width:${pct}%;background:${pct >= 100 ? '#1D9E75' : pct >= 80 ? '#EF9F27' : '#E24B4A'}"></div></div>
  </div>`;
}
