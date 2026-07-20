import { state, save, dbAddPunch, dbDeletePunch, dbUpdateJustStatus } from './store.js';
import { HM, HMh, WDS, meta, calcWork, calcWorkClosed, TM, getHoje, toast, esc } from './utils.js';
import * as XLSX from 'xlsx';

export function genAlerts() {
  const a = [];
  state.EMP.forEach((e, i) => {
    if (e.bank <= -120) a.push({ type: 'err',  icon: 'fa-circle-exclamation',   title: `${e.name} — banco crítico`,   msg: `Saldo: ${HM(e.bank)}. Compensação urgente.` });
    else if (e.bank < 0) a.push({ type: 'warn', icon: 'fa-triangle-exclamation', title: `${e.name} — banco negativo`,  msg: `Saldo: ${HM(e.bank)}.` });
    if (e.due >= 4) a.push({ type: 'warn', icon: 'fa-clock', title: `${e.name} — horas devidas`, msg: `${HMh(e.due)} devidas no mês.` });
    const late = (state.PS[i] || []).find(p => p.type === 'entry');
    if (late) { const [h, m] = late.time.split(':').map(Number); if (h * 60 + m > 8 * 60 + 20) a.push({ type: 'warn', icon: 'fa-clock', title: `${e.name} — entrada tardia`, msg: `Entrada às ${late.time}.` }); }
  });
  return a;
}

export function renderAdmin() {
  const pres = Object.values(state.PS).filter(p => { if (!p || !p.length) return false; const l = p[p.length - 1]; return l.type === 'entry' || l.type === 'return'; }).length;
  const brk  = Object.values(state.PS).filter(p => { if (!p || !p.length) return false; return p[p.length - 1].type === 'break'; }).length;
  const late = Object.values(state.PS).filter(p => { if (!p || !p.length) return false; const e = p.find(x => x.type === 'entry'); if (!e) return false; const [h, m] = e.time.split(':').map(Number); return h * 60 + m > 8 * 60 + 10; }).length;

  document.getElementById('dp').textContent   = pres + brk;
  document.getElementById('da').textContent   = state.EMP.length - pres - brk - Object.values(state.PS).filter(p => p && p.length && p[p.length - 1].type === 'exit').length;
  document.getElementById('dl').textContent   = late;
  document.getElementById('dbrk').textContent = brk;

  const stOf = i => {
    const p = state.PS[i] || [];
    if (!p.length)                     return { dot: 'dr', lbl: 'Ausente' };
    const l = p[p.length - 1];
    if (l.type === 'exit')             return { dot: 'dz', lbl: 'Encerrado' };
    if (l.type === 'break')            return { dot: 'da', lbl: 'Intervalo' };
    return { dot: 'dg', lbl: 'Presente' };
  };

  document.getElementById('tbody').innerHTML = state.EMP.map((e, i) => {
    const ent = (state.PS[i] || []).find(p => p.type === 'entry');
    const s   = stOf(i);
    const wk  = calcWork(state.PS[i] || []);
    const sld = wk - e.j * 60;
    return `<tr><td title="${e.name}">${e.name}</td><td><span class="bc">${e.c}</span></td><td>${ent ? ent.time : '--:--'}</td><td><span class="dot ${s.dot}"></span>${s.lbl}</td><td>${HM(wk)}</td><td style="font-weight:700" class="${sld >= 0 ? 'pos' : 'neg'}">${wk > 0 ? HM(sld) : '--'}</td><td style="font-weight:700;color:${e.bank >= 0 ? '#1D9E75' : '#E24B4A'}">${HM(e.bank)}</td></tr>`;
  }).join('');

  const alerts = genAlerts();
  document.getElementById('alerts-list').innerHTML = alerts.length
    ? alerts.map(a => `<div class="al-item ${a.type === 'err' ? 'al-err' : 'al-warn'}"><i class="fa-solid ${a.icon}" style="font-size:16px;flex-shrink:0;margin-top:1px"></i><div><div style="font-size:13px;font-weight:700">${a.title}</div><div style="font-size:12px;opacity:.85">${a.msg}</div></div></div>`).join('')
    : '<div class="card"><div class="empty"><i class="fa-solid fa-check-circle"></i>Nenhum alerta no momento</div></div>';

  const pend = state.JUSTS.filter(j => j.status === 'pendente');
  document.getElementById('plist').innerHTML = pend.length
    ? pend.map(j => {
        const idx    = state.JUSTS.indexOf(j);
        const files  = j.files || [];
        const badge  = files.length ? `<span class="jf-badge" style="margin-bottom:.5rem;display:inline-flex"><i class="fa-solid fa-paperclip" style="font-size:10px"></i> ${files.length} anexo${files.length > 1 ? 's' : ''}</span><br>` : '';
        const thumbs = files.length ? `<div class="jf-row" style="margin-bottom:.75rem">${files.map(f => { if (f.type === 'img' && f.preview) return `<img src="${f.preview}" class="ft-img" alt="">`; if (f.type === 'pdf') return `<div class="ft-pdf">PDF</div>`; return `<div class="ft-doc">DOC</div>`; }).join('')}</div>` : '';
        return `<div class="card" style="margin-bottom:8px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><span style="font-size:13px;font-weight:700">${esc(state.EMP[j.user] ? state.EMP[j.user].name : '—')}</span><span style="font-size:12px;color:var(--text2)">${esc(j.date)} — ${esc(j.type)}</span></div><div style="font-size:12px;color:var(--text2);margin-bottom:.625rem">${esc(j.desc)}</div>${badge}${thumbs}<div style="display:flex;gap:8px"><button class="brs" onclick="resolveJ(${idx},true)"><i class="fa-solid fa-check"></i> Aprovar</button><button class="brj" onclick="resolveJ(${idx},false)"><i class="fa-solid fa-xmark"></i> Recusar</button></div></div>`;
      }).join('')
    : '<div class="card"><div class="empty"><i class="fa-regular fa-circle-check"></i>Nenhuma pendente</div></div>';

  document.getElementById('repbody').innerHTML = state.EMP.map(e =>
    `<tr><td title="${esc(e.name)}">${esc(e.name)}</td><td><span class="bc">${esc(e.c)}</span></td><td>${e.days}</td><td>${HMh(e.worked)}</td><td>${meta(e)}h</td><td class="pos" style="font-weight:700">+${HMh(e.extra)}</td><td class="neg" style="font-weight:700">${e.due > 0 ? HMh(e.due) : '--'}</td><td style="font-weight:700;color:${e.bank >= 0 ? '#1D9E75' : '#E24B4A'}">${HM(e.bank)}</td></tr>`
  ).join('');

  renderFrequencia();
  renderBankChart();

  const barsHtml = state.EMP.map(e => {
    const pct = Math.min(100, Math.round((e.worked / meta(e)) * 100));
    const bc  = pct >= 100 ? '#1D9E75' : pct >= 80 ? '#EF9F27' : '#E24B4A';
    return `<div style="margin-bottom:8px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:500">${esc(e.name)}</span><span style="font-size:11px;color:var(--text3)">${HMh(e.worked)} (${pct}%)</span></div><div class="bar-mini"><div class="bf-mini" style="width:${pct}%;background:${bc}"></div></div></div>`;
  }).join('');
  document.getElementById('dash-chart').innerHTML = `<div class="sl">Progresso mensal da equipe</div>${barsHtml}`;

  renderEdit();
}

export function resolveJ(idx, approve) {
  const just   = state.JUSTS[idx];
  const status = approve ? 'aprovado' : 'recusado';
  (async () => {
    await dbUpdateJustStatus(just, status);
    just.status = status;
    save();
    renderAdmin();
    toast(approve ? '✓ Aprovada' : 'Recusada');
  })();
}

export function buildEditDates() {
  const sel = document.getElementById('edate');
  const all = [getHoje(), ...(state.HIST[state.eu] || []).map(d => d.date)]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30);
  sel.innerHTML = all.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return `<option value="${d}">${WDS[dt.getDay()]} ${d.split('-').reverse().join('/')}</option>`;
  }).join('');
}

const _maps = {};

async function geocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'pt-BR' },
    });
    const d = await r.json();
    const a = d.address || {};
    const road   = a.road || a.pedestrian || a.path || '';
    const number = a.house_number ? `, ${a.house_number}` : '';
    const city   = a.city || a.town || a.village || a.municipality || '';
    return road ? `${road}${number}${city ? ` — ${city}` : ''}` : (d.display_name || '');
  } catch { return ''; }
}

export function renderPunchMap(recs, prefix = 'punch-map') {
  const entry = recs.find(r => r.type === 'entry' && r.lat != null);
  const exit  = recs.find(r => r.type === 'exit'  && r.lat != null);

  const wrapId      = prefix === 'punch-map' ? 'punch-map-wrap'      : `${prefix}-wrap`;
  const addrId      = prefix === 'punch-map' ? 'punch-map-addr'      : `${prefix}-addr`;
  const containerId = prefix === 'punch-map' ? 'punch-map-container' : `${prefix}-container`;

  const wrap = document.getElementById(wrapId);
  if (!wrap) return;

  if (!entry && !exit) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  // Endereços como texto acima do mapa
  const addrDiv = document.getElementById(addrId);
  if (addrDiv) addrDiv.innerHTML = '<div style="font-size:12px;color:var(--text3)">Carregando endereços…</div>';

  const addrPromises = [];
  if (entry) addrPromises.push(geocode(entry.lat, entry.lng).then(a => ({ label: 'Entrada', time: entry.time, addr: a, color: '#1D9E75' })));
  if (exit)  addrPromises.push(geocode(exit.lat,  exit.lng ).then(a => ({ label: 'Saída',   time: exit.time,  addr: a, color: '#E24B4A' })));
  Promise.all(addrPromises).then(results => {
    if (!addrDiv) return;
    addrDiv.innerHTML = results.map(r =>
      `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:5px">
        <span style="width:10px;height:10px;border-radius:50%;background:${r.color};flex-shrink:0;margin-top:2px;display:inline-block"></span>
        <span style="font-size:12px;color:var(--text2)"><b>${r.label}</b> ${r.time}${r.addr ? ` — ${r.addr}` : ''}</span>
      </div>`
    ).join('');
  });

  // Destruir mapa anterior e recriar o elemento DOM (fix para Leaflet com display:none)
  if (_maps[prefix]) { _maps[prefix].remove(); _maps[prefix] = null; }
  const container = document.getElementById(containerId);
  const mapElId   = `${prefix}-leaflet`;
  const fresh = document.createElement('div');
  fresh.id = mapElId;
  fresh.style.cssText = 'width:100%;height:260px';
  container.innerHTML = '';
  container.appendChild(fresh);

  // Inicializar após o browser calcular o layout
  requestAnimationFrame(() => {
    const center = entry ? [entry.lat, entry.lng] : [exit.lat, exit.lng];
    const map = window.L.map(mapElId).setView(center, 16);
    _maps[prefix] = map;
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);

    const mkIcon = color => window.L.divIcon({
      className: '',
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });

    if (entry) window.L.marker([entry.lat, entry.lng], { icon: mkIcon('#1D9E75') }).addTo(map).bindPopup(`<b>Entrada</b> ${entry.time}`);
    if (exit)  window.L.marker([exit.lat,  exit.lng],  { icon: mkIcon('#E24B4A') }).addTo(map).bindPopup(`<b>Saída</b> ${exit.time}`);

    if (entry && exit) {
      map.fitBounds(window.L.latLngBounds([[entry.lat, entry.lng], [exit.lat, exit.lng]]), { padding: [40, 40] });
    }

    map.invalidateSize();
  });
}

export function renderEdit() {
  const sel = document.getElementById('edate');
  const dv  = sel.value || getHoje();
  const dt  = new Date(dv + 'T12:00:00');
  document.getElementById('etit').textContent = `${state.EMP[state.eu] ? state.EMP[state.eu].name : '—'} — ${WDS[dt.getDay()]} ${dv.split('-').reverse().join('/')}`;
  const recs = dv === getHoje()
    ? (state.PS[state.eu] || [])
    : ((state.HIST[state.eu] || []).find(d => d.date === dv) || { records: [] }).records;
  document.getElementById('elist').innerHTML = recs.length
    ? '<div class="rl">' + recs.map((p, i) => {
        const tm = TM[p.type] || { lbl: p.type, cls: 'rb-e' };
        return `<div class="ri"><div><div class="ri-name">${tm.lbl}${p.obs ? ` <span style="font-size:11px;color:var(--text3)">(${esc(p.obs)})</span>` : ''}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="rb ${tm.cls}">${esc(p.time)}</span><button onclick="delER('${dv}',${i})" class="bsm" style="padding:4px 7px;color:#E24B4A;border-color:#E24B4A" title="Remover"><i class="fa-solid fa-trash-can" style="font-size:12px"></i></button></div></div>`;
      }).join('') + '</div>'
    : '<div class="card"><div class="empty"><i class="fa-regular fa-clock"></i>Nenhum registro nesta data</div></div>';

  renderPunchMap(recs);
}

export function delER(date, idx) {
  if (!confirm('Remover este registro?')) return;
  (async () => {
    let rec;
    if (date === getHoje()) {
      rec = state.PS[state.eu][idx];
      await dbDeletePunch(rec);
      state.PS[state.eu].splice(idx, 1);
    } else {
      const dh = (state.HIST[state.eu] || []).find(d => d.date === date);
      if (dh) { rec = dh.records[idx]; await dbDeletePunch(rec); dh.records.splice(idx, 1); }
    }
    save();
    renderEdit();
    toast('Registro removido');
  })();
}

export function openAdd()  { document.getElementById('addform').style.display = 'block'; }
export function closeAdd() { document.getElementById('addform').style.display = 'none'; }

export function saveAdd() {
  const type = document.getElementById('atype').value;
  const time = document.getElementById('atime').value;
  const obs  = document.getElementById('aobs').value.trim();
  if (!time) { toast('Informe o horário', false); return; }
  const dv  = document.getElementById('edate').value || getHoje();
  const rec = { type, time };
  if (obs) rec.obs = obs;
  (async () => {
    const dbRec = await dbAddPunch(state.eu, rec, dv);
    if (dbRec) rec._id = dbRec.id;
    if (dv === getHoje()) {
      if (!state.PS[state.eu]) state.PS[state.eu] = [];
      state.PS[state.eu].push(rec);
    } else {
      if (!state.HIST[state.eu]) state.HIST[state.eu] = [];
      let dh = state.HIST[state.eu].find(d => d.date === dv);
      if (!dh) { dh = { date: dv, records: [] }; state.HIST[state.eu].push(dh); }
      dh.records.push(rec);
      dh.records.sort((a, b) => a.time.localeCompare(b.time));
    }
    document.getElementById('aobs').value = '';
    closeAdd();
    save();
    renderEdit();
    buildEditDates();
    toast('✓ Registro adicionado');
  })();
}

// Monta o dataset (header + rows) usado por CSV e XLSX.
// Retorna { header: string[], rows: Array<Array<string|number>>, baseFname: string }.
function _buildExportDataset(mode) {
  const sel  = document.getElementById('ru').value;
  const rs   = document.getElementById('rs').value;
  const re   = document.getElementById('re').value;
  const emps = sel === 'all'
    ? state.EMP.map((e, i) => ({ ...e, idx: i }))
    : [{ ...state.EMP[parseInt(sel)], idx: parseInt(sel) }];

  if (mode === 'espelho') {
    const header = ['Colaborador','Cargo','Contrato','Data','Dia','Entrada','Intervalo','Retorno','Saída','Horas Trabalhadas','Saldo do Dia'];
    const rows = [];
    emps.forEach(e => {
      (state.HIST[e.idx] || [])
        .filter(d => d.date >= rs && d.date <= re)
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach(d => {
          const dt  = new Date(d.date + 'T12:00:00');
          const ent = d.records.find(p => p.type === 'entry');
          const brk = d.records.find(p => p.type === 'break');
          const ret = d.records.find(p => p.type === 'return');
          const ex  = d.records.find(p => p.type === 'exit');
          const wk  = calcWorkClosed(d.records);
          const sld = wk - e.j * 60;
          rows.push([
            e.name, e.cargo, e.c,
            d.date.split('-').reverse().join('/'),
            WDS[dt.getDay()],
            ent ? ent.time : '--', brk ? brk.time : '--', ret ? ret.time : '--', ex ? ex.time : '--',
            HM(wk), (sld >= 0 ? '+' : '') + HM(sld),
          ]);
        });
    });
    return { header, rows, baseFname: `vi-espelho-${rs}-${re}` };
  }

  if (mode === 'resumo') {
    const header = ['Colaborador','Cargo','Contrato','Jornada(h)','Dias','Meta(h)','Trabalhadas','Extras','Devidas','Banco(min)','Banco'];
    const rows = emps.map(e => [
      e.name, e.cargo, e.c, e.j, e.days, meta(e), HMh(e.worked), '+' + HMh(e.extra),
      e.due > 0 ? HMh(e.due) : '0h00', e.bank, HM(e.bank),
    ]);
    return { header, rows, baseFname: `vi-resumo-${rs}-${re}` };
  }

  // banco (default)
  const header = ['Colaborador','Cargo','Contrato','Jornada(h)','Banco(min)','Banco','Extras Acum.','Devidas Acum.'];
  const rows = emps.map(e => [
    e.name, e.cargo, e.c, e.j, e.bank, HM(e.bank), '+' + HMh(e.extra),
    e.due > 0 ? HMh(e.due) : '0h00',
  ]);
  return { header, rows, baseFname: `vi-banco-${getHoje()}` };
}

export function expCSV(mode) {
  const { header, rows, baseFname } = _buildExportDataset(mode);
  const bom = '﻿';
  const csv = bom + header.join(',') + '\n' + rows.map(r => r.join(',')).join('\n') + '\n';
  const fname = `${baseFname}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  toast('✓ Exportado: ' + fname);
}

// ── Relatório de frequência mensal ────────────────────────────
// Conta faltas / atrasos / saídas antecipadas por colaborador no
// período selecionado nos inputs #rs / #re. Segundos-graça definidos
// em constantes (fáceis de ajustar sem tocar em regra de negócio).
const LIMITE_ENTRADA_ATRASO = 8 * 60 + 20;    // 08:20 → atraso
const LIMITE_SAIDA_ANTECIPADA = 17 * 60 + 40; // 17:40 → saída antes

function contarFrequencia(empIdx, rs, re) {
  // Gera lista de dias úteis (seg-sex) no intervalo.
  const previstos = [];
  const cur = new Date(rs + 'T12:00:00');
  const fim = new Date(re + 'T12:00:00');
  while (cur <= fim) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) {
      previstos.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    }
    cur.setDate(cur.getDate() + 1);
  }

  const hist = state.HIST[empIdx] || [];
  const porData = new Map(hist.filter(d => d.date >= rs && d.date <= re).map(d => [d.date, d.records]));

  let faltas = 0, atrasos = 0, saidasAntes = 0;
  previstos.forEach((data) => {
    const recs = porData.get(data);
    if (!recs || !recs.length) { faltas += 1; return; }
    const ent = recs.find(p => p.type === 'entry');
    if (ent) {
      const [h, m] = ent.time.split(':').map(Number);
      if (h * 60 + m > LIMITE_ENTRADA_ATRASO) atrasos += 1;
    }
    const ex = recs.find(p => p.type === 'exit');
    if (ex) {
      const [h, m] = ex.time.split(':').map(Number);
      if (h * 60 + m < LIMITE_SAIDA_ANTECIPADA) saidasAntes += 1;
    }
  });

  return { previstos: previstos.length, faltas, atrasos, saidasAntes };
}

export function renderFrequencia() {
  const el = document.getElementById('freqbody');
  if (!el) return;
  const rs = document.getElementById('rs')?.value;
  const re = document.getElementById('re')?.value;
  if (!rs || !re) { el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:12px">Selecione um intervalo acima</td></tr>'; return; }

  el.innerHTML = state.EMP.map((e, i) => {
    const f = contarFrequencia(i, rs, re);
    const trabalhados = f.previstos - f.faltas;
    const adesao = f.previstos > 0 ? Math.round((trabalhados / f.previstos) * 100) : 0;
    const cor = adesao >= 95 ? '#1D9E75' : adesao >= 80 ? '#EF9F27' : '#E24B4A';
    return `<tr>
      <td title="${esc(e.name)}">${esc(e.name)}</td>
      <td>${f.previstos}</td>
      <td style="font-weight:700;color:${f.faltas > 0 ? '#E24B4A' : 'var(--text3)'}">${f.faltas}</td>
      <td style="font-weight:700;color:${f.atrasos > 0 ? '#EF9F27' : 'var(--text3)'}">${f.atrasos}</td>
      <td style="font-weight:700;color:${f.saidasAntes > 0 ? '#EF9F27' : 'var(--text3)'}">${f.saidasAntes}</td>
      <td style="font-weight:700;color:${cor}">${adesao}%</td>
    </tr>`;
  }).join('');
}

// ── Gráfico de banco de horas (SVG inline, sem lib) ───────────
// Últimos 6 meses. Uma linha por colaborador.
export function renderBankChart() {
  const el = document.getElementById('bankchart');
  if (!el) return;

  // Coleta banco mensal (proxy: soma de (trabalhado - meta) por mês, a partir de HIST)
  const meses = [];
  const hoje = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const dadosPorEmp = state.EMP.map((e, i) => {
    const hist = state.HIST[i] || [];
    const bankMes = meses.map((m) => {
      const days = hist.filter(d => d.date.startsWith(m));
      const meta = e.j * 60;
      return days.reduce((s, d) => s + (calcWorkClosed(d.records) - meta), 0);
    });
    return { name: e.name, bank: bankMes };
  });

  if (dadosPorEmp.every(d => d.bank.every(v => v === 0))) {
    el.innerHTML = '<div class="empty"><i class="fa-regular fa-chart-line"></i>Sem histórico suficiente para plotar</div>';
    return;
  }

  // Escala Y baseada no min/max de todos os pontos
  const allVals = dadosPorEmp.flatMap(d => d.bank);
  const maxAbs = Math.max(60, ...allVals.map(Math.abs));
  const H = 160, W = 640, PAD_L = 60, PAD_B = 40, PAD_T = 12, PAD_R = 12;
  const chartH = H - PAD_T - PAD_B;
  const chartW = W - PAD_L - PAD_R;
  const xStep = chartW / (meses.length - 1);
  const yMid = PAD_T + chartH / 2;
  const yFor = (v) => yMid - (v / maxAbs) * (chartH / 2);
  const xFor = (i) => PAD_L + i * xStep;

  const cores = ['#1D6B4A', '#3B82F6', '#EF9F27', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#0EA5E9'];

  // Grid horizontal (0, ±max/2, ±max)
  const gridLines = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs]
    .map(v => `<line x1="${PAD_L}" y1="${yFor(v)}" x2="${W - PAD_R}" y2="${yFor(v)}" stroke="${v === 0 ? '#999' : '#E5E5E5'}" stroke-width="${v === 0 ? 1.2 : 1}"/><text x="${PAD_L - 6}" y="${yFor(v) + 4}" text-anchor="end" font-size="10" fill="#999">${HM(v)}</text>`)
    .join('');

  // Rótulos X (meses)
  const xLabels = meses.map((m, i) => {
    const [y, mo] = m.split('-');
    const nome = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(mo) - 1];
    return `<text x="${xFor(i)}" y="${H - 20}" text-anchor="middle" font-size="10" fill="#666">${nome}/${y.slice(2)}</text>`;
  }).join('');

  // Linhas por colaborador
  const linhas = dadosPorEmp.map((d, empIdx) => {
    const cor = cores[empIdx % cores.length];
    const pts = d.bank.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
    const dots = d.bank.map((v, i) => `<circle cx="${xFor(i)}" cy="${yFor(v)}" r="3" fill="${cor}"/>`).join('');
    return `<polyline fill="none" stroke="${cor}" stroke-width="2" points="${pts}"/>${dots}`;
  }).join('');

  const legenda = dadosPorEmp.map((d, i) => {
    const cor = cores[i % cores.length];
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text2);margin-right:12px"><span style="width:12px;height:3px;background:${cor};border-radius:2px"></span>${esc(d.name)}</span>`;
  }).join('');

  el.innerHTML = `
    <div style="overflow-x:auto">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${W}px;height:${H}px" xmlns="http://www.w3.org/2000/svg">
        ${gridLines}
        ${xLabels}
        ${linhas}
      </svg>
    </div>
    <div style="margin-top:8px;line-height:1.8">${legenda}</div>
  `;
}

// Exporta o mesmo dataset em XLSX (SheetJS). Mais confiável para colar em
// planilhas com acentos e delimitadores regionais que o CSV não resolve.
export function expXLSX(mode) {
  const { header, rows, baseFname } = _buildExportDataset(mode);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Larguras de coluna automáticas (aproximadas pelo tamanho do maior valor)
  ws['!cols'] = header.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  const sheetName = mode === 'espelho' ? 'Espelho' : mode === 'resumo' ? 'Resumo' : 'Banco';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const fname = `${baseFname}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast('✓ Exportado: ' + fname);
}
