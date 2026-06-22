import { state } from './store.js';
import { HM, HMh, meta, calcWorkClosed, F } from './utils.js';

function buildWeeks(empIdx) {
  const hist = state.HIST[empIdx] || [];
  const byWeek = {};
  hist.forEach(d => {
    const dt  = new Date(d.date + 'T12:00:00');
    const mon = new Date(dt);
    mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = `${mon.getFullYear()}-${F(mon.getMonth() + 1)}-${F(mon.getDate())}`;
    if (!byWeek[key]) byWeek[key] = { start: new Date(mon), totalMin: 0, days: 0 };
    byWeek[key].totalMin += calcWorkClosed(d.records);
    byWeek[key].days++;
  });
  return Object.entries(byWeek)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 4)
    .reverse()
    .map(([, wk]) => {
      const end = new Date(wk.start);
      end.setDate(wk.start.getDate() + 6);
      return {
        label:    `${wk.start.getDate()}/${wk.start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`,
        totalMin: wk.totalMin,
        days:     wk.days,
      };
    });
}

export function renderBank() {
  const i   = state.cu;
  const e   = state.EMP[i];
  const bal = e.bank;
  const m   = meta(e);

  document.getElementById('btot').textContent = HM(bal);
  document.getElementById('btot').style.color = bal >= 0 ? '#1D9E75' : '#E24B4A';
  document.getElementById('bext').textContent = HMh(e.extra);
  document.getElementById('bdue').textContent = HMh(e.due);
  document.getElementById('bmeta').textContent = m + 'h';

  const pct = Math.min(100, Math.max(5, 50 + (bal / (e.j * 60)) * 50));
  document.getElementById('bbar').style.width      = pct + '%';
  document.getElementById('bbar').style.background = bal >= 0 ? '#1D9E75' : '#E24B4A';

  const weeks = buildWeeks(i);
  if (!weeks.length) {
    document.getElementById('wbd').innerHTML = '<div class="card"><div class="empty"><i class="fa-regular fa-clock"></i>Sem histórico disponível</div></div>';
    return;
  }
  const dailyTarget = e.j * 60;
  document.getElementById('wbd').innerHTML = '<div class="rl">' +
    weeks.map(w => {
      const target = dailyTarget * w.days;
      const saldo  = w.totalMin - target;
      const cls    = saldo > 0 ? 'pos' : saldo < 0 ? 'neg' : '';
      return `<div class="ri"><div><div class="ri-name">Semana ${w.label}</div><div class="ri-sub">${HM(w.totalMin)} trabalhadas · ${w.days} dia${w.days !== 1 ? 's' : ''}</div></div><span style="font-size:13px;font-weight:700" class="${cls}">${saldo >= 0 ? '+' : ''}${HM(saldo)}</span></div>`;
    }).join('') +
    '</div>';
}
