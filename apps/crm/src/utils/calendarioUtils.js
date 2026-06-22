// src/utils/calendarioUtils.js

export const TIPO_COR = {
  visita:    '#10B981',
  envio:     '#3B82F6',
  aprovacao: '#F59E0B',
  prazo:     '#EF4444',
  tarefa:    '#8B5CF6',
};

export const TIPO_LABEL = {
  visita:    'Visita técnica',
  envio:     'Orçamento enviado',
  aprovacao: 'Prazo de aprovação',
  prazo:     'Prazo do fluxo',
  tarefa:    'Tarefa',
};

export const TIPO_ICONE = {
  visita:    '🗓',
  envio:     '📤',
  aprovacao: '⏰',
  prazo:     '🔴',
  tarefa:    '✅',
};

export function getEventosPorData(leads) {
  const mapa = {};

  function add(iso, tipo, label, leadId, leadNome) {
    if (!iso) return;
    if (!mapa[iso]) mapa[iso] = [];
    mapa[iso].push({ tipo, label, leadId, leadNome });
  }

  leads.forEach((lead) => {
    const nome = lead.empresa;
    const id   = lead.id;

    (lead.visitas ?? []).forEach((v) => {
      if (v.data) add(v.data, 'visita', v.obs ? `Visita · ${v.obs}` : 'Visita técnica', id, nome);
    });

    const fluxo = lead.fluxoOrcamento;
    if (!fluxo) return;

    if (fluxo.t2?.enviadoEm) {
      add(fluxo.t2.enviadoEm, 'envio', 'Orçamento enviado', id, nome);
    }

    const historico = fluxo.cicloAprovacao?.historico ?? [];
    const ativo = historico.find((h) => !h.resolvidoEm && h.prazoData);
    if (ativo) {
      add(ativo.prazoData, 'aprovacao', 'Prazo de aprovação', id, nome);
    }

    if (fluxo.t1?.status === 'pendente' && fluxo.t1?.prazoData) {
      add(fluxo.t1.prazoData, 'prazo', 'Prazo T1 · Preencher orçamento', id, nome);
    }
    if (fluxo.t2?.status === 'pendente' && fluxo.t2?.prazoData) {
      add(fluxo.t2.prazoData, 'prazo', 'Prazo T2 · Elaborar orçamento', id, nome);
    }
    if (fluxo.t3?.status === 'pendente' && fluxo.t3?.prazoData) {
      add(fluxo.t3.prazoData, 'prazo', 'Prazo T3 · Conferir recebimento', id, nome);
    }
  });

  return mapa;
}

export function formatarDataLonga(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatarDataCurta(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export const MESES_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const DIAS_SEMANA_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export function addMes(ano, mes, delta) {
  let m = mes + delta;
  let a = ano;
  if (m > 11) { m -= 12; a += 1; }
  if (m < 0)  { m += 12; a -= 1; }
  return { ano: a, mes: m };
}

export function buildGrid(ano, mes) {
  const primeiroDia  = new Date(ano, mes, 1).getDay();
  const diasNoMes    = new Date(ano, mes + 1, 0).getDate();
  const totalCelulas = Math.ceil((primeiroDia + diasNoMes) / 7) * 7;
  return Array.from({ length: totalCelulas }, (_, i) => {
    const dia = i - primeiroDia + 1;
    if (dia < 1 || dia > diasNoMes) return null;
    return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  });
}
