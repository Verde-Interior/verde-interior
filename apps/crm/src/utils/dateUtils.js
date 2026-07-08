// src/utils/dateUtils.js — Funções de data compartilhadas pelo CRM

const PAD = n => (n < 10 ? '0' + n : String(n));

const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESES_LONGO = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS_ABREV  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DIAS_LONGO  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

// Data local de hoje no formato YYYY-MM-DD
export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

// Converte Date → YYYY-MM-DD (usa timezone local)
export function dateParaISO(d) {
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

// Adiciona dias a uma data ISO
export function addDias(iso, n) {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + n);
  return dateParaISO(d);
}

// Diferença em dias entre duas datas ISO (iso2 - iso1)
export function diasEntre(iso1, iso2) {
  const d1 = new Date(iso1 + 'T00:00');
  const d2 = new Date(iso2 + 'T00:00');
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// Formatação: "07/07/2026" (padrão brasileiro)
export function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR');
}

// Formatação curta: "07/jul"
export function formatarDataCurta(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00');
  return `${PAD(d.getDate())}/${MESES_ABREV[d.getMonth()]}`;
}

// Formatação longa: "Segunda, 7 de julho"
export function formatarDataLonga(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00');
  return `${DIAS_LONGO[d.getDay()]}, ${d.getDate()} de ${MESES_LONGO[d.getMonth()]}`;
}

// Formatação completa: "07/07/2026 14:30"
export function formatarDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Semana ISO (Seg → Sáb) a partir de uma data referência
export function getSemana(refDate) {
  const d = typeof refDate === 'string' ? new Date(refDate + 'T12:00') : new Date(refDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const seg = new Date(d);
  seg.setDate(d.getDate() + diff);
  const semana = [];
  for (let i = 0; i < 6; i++) {
    const curr = new Date(seg);
    curr.setDate(seg.getDate() + i);
    semana.push(dateParaISO(curr));
  }
  return semana;
}

// Slug do dia da semana ('domingo'|'segunda'|...) a partir de data ISO
const DIA_SLUG = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
export function getDiaSlug(iso) {
  const d = new Date(iso + 'T12:00');
  return DIA_SLUG[d.getDay()];
}

export { MESES_ABREV, MESES_LONGO, DIAS_ABREV, DIAS_LONGO };
