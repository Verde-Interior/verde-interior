import { state, save, dbAddPunch, dbDeletePunch, dbUpdateEmployeeStats } from './store.js';
import { F, HM, TM, TKEY, calcWork, getStatus, getNext, toast } from './utils.js';
import { AUTH } from './auth.js';

export function renderPunch() {
  const i  = state.cu;
  const st = getStatus(state.PS, i);
  const np = getNext(state.PS, i);

  document.getElementById('pstat').textContent = st.lbl;
  document.getElementById('pstat').className   = 'ps-badge ' + st.css;
  document.getElementById('plbl').textContent  = np.lbl;

  const ent = (state.PS[i] || []).find(p => p.type === 'entry');
  document.getElementById('ce').textContent = ent ? ent.time : '--:--';

  const wk = calcWork(state.PS[i] || []);
  document.getElementById('cw').textContent = HM(wk);

  const sld = wk - state.EMP[i].j * 60;
  const se  = document.getElementById('cs');
  se.textContent = wk > 0 ? HM(sld) : '--';
  se.className   = 'mv ' + (sld >= 0 ? 'pos' : 'neg');

  document.getElementById('xrow').innerHTML = st.s === 'in'
    ? `<button class="exit-btn" onclick="doExit()"><i class="fa-solid fa-right-from-bracket"></i> Finalizar Expediente</button>`
    : '';

  const recs = state.PS[i] || [];
  const tr   = document.getElementById('trecs');
  tr.innerHTML = recs.length
    ? `<div class="sl">Registros de hoje</div><div class="rl">${recs.map((p, idx) => {
        const tm = TM[p.type] || { lbl: p.type, cls: 'rb-e' };
        const isGestor = AUTH.getSession()?.role === 'gestor';
        const delBtn = isGestor ? `<button onclick="delTR(${idx})" class="bsm" style="padding:4px 7px;color:#E24B4A;border-color:#E24B4A" title="Remover"><i class="fa-solid fa-trash-can" style="font-size:12px"></i></button>` : '';
        return `<div class="ri"><div><div class="ri-name">${tm.lbl}${p.obs ? ` <span style="font-size:11px;color:var(--text3)">(${p.obs})</span>` : ''}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="rb ${tm.cls}">${p.time}</span>${delBtn}</div></div>`;
      }).join('')}</div>`
    : '<div class="card"><div class="empty"><i class="fa-regular fa-clock"></i>Nenhum registro hoje</div></div>';
}

function getCoords() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p  => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 0 }
    );
  });
}

export function doPunch() {
  const np  = getNext(state.PS, state.cu);
  const btn = document.getElementById('pbtn');
  btn.classList.add('act');
  const n = new Date();
  const t = F(n.getHours()) + ':' + F(n.getMinutes());
  setTimeout(async () => {
    if (!state.PS[state.cu]) state.PS[state.cu] = [];
    const coords = (np.type === 'entry' || np.type === 'exit') ? await getCoords() : null;
    const rec    = { type: np.type, time: t, ...(coords || {}) };
    const dbRec  = await dbAddPunch(state.cu, rec);
    if (dbRec) rec._id = dbRec.id;
    state.PS[state.cu].push(rec);
    btn.classList.remove('act');
    renderPunch();
    save();
    const msgs = { entry: '✓ Entrada registrada', break: 'Intervalo iniciado', return: 'Retorno registrado' };
    toast(msgs[np.type] || 'Ponto registrado');
  }, 500);
}

export function doExit() {
  const n = new Date();
  const t = F(n.getHours()) + ':' + F(n.getMinutes());
  if (!state.PS[state.cu]) state.PS[state.cu] = [];
  (async () => {
    const coords = await getCoords();
    const rec = { type: 'exit', time: t, ...(coords || {}) };
    const dbRec = await dbAddPunch(state.cu, rec);
    if (dbRec) rec._id = dbRec.id;
    state.PS[state.cu].push(rec);
    if (!state.HIST[state.cu]) state.HIST[state.cu] = [];
    const ex = state.HIST[state.cu].findIndex(d => d.date === TKEY);
    const en = { date: TKEY, records: [...state.PS[state.cu]] };
    if (ex >= 0) state.HIST[state.cu][ex] = en;
    else state.HIST[state.cu].unshift(en);

    // Atualizar banco de horas do dia
    const emp = state.EMP[state.cu];
    if (emp) {
      const workedMin  = calcWork(state.PS[state.cu]);
      const dailySaldo = workedMin - emp.j * 60;
      emp.bank  += dailySaldo;
      emp.days  += 1;
      emp.worked = Number((emp.worked + workedMin / 60).toFixed(2));
      if (dailySaldo > 0) emp.extra = Number((emp.extra + dailySaldo / 60).toFixed(2));
      else                emp.due   = Number((emp.due   - dailySaldo / 60).toFixed(2));
      await dbUpdateEmployeeStats(state.cu);
    }

    renderPunch();
    save();
    toast('✓ Expediente finalizado');
  })();
}

export function delTR(idx) {
  if (AUTH.getSession()?.role !== 'gestor') { toast('Sem permissão para remover registros', false); return; }
  if (!confirm('Remover este registro?')) return;
  const rec = state.PS[state.cu][idx];
  (async () => {
    await dbDeletePunch(rec);
    state.PS[state.cu].splice(idx, 1);
    renderPunch();
    save();
    toast('Registro removido');
  })();
}
