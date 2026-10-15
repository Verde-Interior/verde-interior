// src/components/Ponto/pontoExport.js
import { supabase } from '../../lib/supabase';

const F = (n) => (n < 10 ? '0' + n : String(n));
const HM = (min) => {
  const s = min < 0 ? '-' : '';
  const v = Math.abs(Math.round(min));
  return `${s}${Math.floor(v / 60)}h${F(v % 60)}`;
};
const HMh = (h) => HM(Math.round(h * 60));
const WDS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Fecha só segmentos entrada→(intervalo|saída) já pareados — nunca estende
// até "agora", porque um relatório de período passado não deve inventar
// horas de um registro em aberto.
function calcFechado(recs) {
  let t = 0, e = null;
  for (const p of recs) {
    const [h, m] = p.time.split(':').map(Number);
    const min = h * 60 + m;
    if (p.type === 'entry' || p.type === 'return') e = min;
    if ((p.type === 'break' || p.type === 'exit') && e !== null) { t += min - e; e = null; }
  }
  return t;
}

// Busca employees + punch_records do período e monta { header, rows, baseFname }.
// mode: 'espelho' | 'resumo' | 'banco'
export async function buildExportDataset(mode, { rs, re, colaboradorId }) {
  const empQuery = supabase.from('employees').select('*').order('name');
  const { data: empsAll } = colaboradorId === 'all'
    ? await empQuery
    : await empQuery.eq('id', colaboradorId);
  const emps = empsAll ?? [];

  const { data: punches } = await supabase
    .from('punch_records')
    .select('employee_id,date,type,time')
    .gte('date', rs)
    .lte('date', re)
    .in('employee_id', emps.map((e) => e.id).length ? emps.map((e) => e.id) : [-1]);

  const porEmpData = {};
  (punches ?? []).forEach((p) => {
    if (!porEmpData[p.employee_id]) porEmpData[p.employee_id] = {};
    if (!porEmpData[p.employee_id][p.date]) porEmpData[p.employee_id][p.date] = [];
    porEmpData[p.employee_id][p.date].push(p);
  });
  Object.values(porEmpData).forEach((porData) => {
    Object.values(porData).forEach((arr) => arr.sort((a, b) => a.time.localeCompare(b.time)));
  });

  if (mode === 'espelho') {
    const header = ['Colaborador', 'Cargo', 'Contrato', 'Data', 'Dia', 'Entrada', 'Intervalo', 'Retorno', 'Saída', 'Horas Trabalhadas', 'Saldo do Dia'];
    const rows = [];
    emps.forEach((e) => {
      const porData = porEmpData[e.id] || {};
      Object.keys(porData).sort().forEach((iso) => {
        const recs = porData[iso];
        const dt = new Date(iso + 'T12:00:00');
        const ent = recs.find((p) => p.type === 'entry');
        const brk = recs.find((p) => p.type === 'break');
        const ret = recs.find((p) => p.type === 'return');
        const sai = [...recs].reverse().find((p) => p.type === 'exit');
        const wk = calcFechado(recs);
        const sld = wk - e.daily_hours * 60;
        rows.push([
          e.name, e.cargo, e.contract_type,
          iso.split('-').reverse().join('/'),
          WDS[dt.getDay()],
          ent ? ent.time : '--', brk ? brk.time : '--', ret ? ret.time : '--', sai ? sai.time : '--',
          HM(wk), (sld >= 0 ? '+' : '') + HM(sld),
        ]);
      });
    });
    return { header, rows, baseFname: `vi-crm-espelho-${rs}-${re}` };
  }

  if (mode === 'resumo') {
    const header = ['Colaborador', 'Cargo', 'Contrato', 'Jornada(h)', 'Dias', 'Trabalhadas', 'Extras', 'Devidas', 'Banco'];
    const rows = emps.map((e) => {
      const porData = porEmpData[e.id] || {};
      const dias = Object.keys(porData);
      let worked = 0;
      dias.forEach((iso) => { worked += calcFechado(porData[iso]); });
      const meta = e.daily_hours * 60 * dias.length;
      const saldo = worked - meta;
      return [
        e.name, e.cargo, e.contract_type, e.daily_hours, dias.length,
        HM(worked), saldo > 0 ? '+' + HM(saldo) : '0h00', saldo < 0 ? HM(-saldo) : '0h00',
        (saldo >= 0 ? '+' : '') + HM(saldo),
      ];
    });
    return { header, rows, baseFname: `vi-crm-resumo-${rs}-${re}` };
  }

  // banco — saldo acumulado atual (não depende do período, é o total corrente)
  const header = ['Colaborador', 'Cargo', 'Contrato', 'Jornada(h)', 'Banco', 'Extras Acum.', 'Devidas Acum.'];
  const rows = emps.map((e) => [
    e.name, e.cargo, e.contract_type, e.daily_hours,
    HM(e.bank_minutes), '+' + HMh(Number(e.extra_hours) || 0),
    (Number(e.due_hours) || 0) > 0 ? HMh(Number(e.due_hours)) : '0h00',
  ]);
  return { header, rows, baseFname: `vi-crm-banco-${rs}` };
}

export function exportCSV({ header, rows, baseFname }) {
  const bom = '﻿';
  const csv = bom + header.join(',') + '\n' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseFname}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// XLSX carregado sob demanda — biblioteca pesada, só entra no bundle
// quando alguém realmente clica em exportar Excel.
export async function exportXLSX({ header, rows, baseFname }, sheetName) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = header.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${baseFname}.xlsx`);
}
