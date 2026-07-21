// src/utils/escalaHelpers.js
// Helpers de negócio da EscalaCampo (restrições de cliente, conflitos, prioridade).
// Extraído de EscalaCampo.jsx.

import { addDias, diasEntre, getDiaSlug as getDiaSlugUtil } from './dateUtils';
import { horaEmMinutos, minutosParaHora } from './otimizadorRota';

// ── Constantes ─────────────────────────────────────────────────────────
export const DIAS_LABEL = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb' };
export const DIAS_NOME  = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };

export const TIPO_LABEL = {
  manutencao: 'Manutenção', locacao: 'Locação',
  flores: 'Flores', reforma: 'Reforma', venda: 'Venda', evento: 'Evento',
};
export const TIPO_COR = {
  manutencao: '#3D6B1E', locacao: '#2563EB',
  flores: '#9333EA', reforma: '#C47A1A', venda: '#1A7A4A', evento: '#C23B3B',
};

export const TIPOS_TAREFA = [
  { id: 'manutencao', label: 'Manutenção', frase: 'manutenção das plantas' },
  { id: 'troca',      label: 'Troca',      frase: 'trocas' },
  { id: 'reforma',    label: 'Reforma',    frase: 'reforma' },
  { id: 'evento',     label: 'Evento',     frase: 'evento' },
  { id: 'outro',      label: 'Outro',      frase: null },
];

export const FREQ_INTERVALO = {
  '3x_semana': 2,
  '2x_semana': 3,
  '1x_semana': 7,
  'quinzenal': 14,
  'mensal':    30,
};

export const FREQ_LABEL_LOCAL = {
  '3x_semana': '3× semana',
  '2x_semana': '2× semana',
  '1x_semana': '1× semana',
  'quinzenal': 'quinzenal',
  'mensal':    'mensal',
};

export const PRIORIDADE_LABEL = {
  critica: 'Crítica',
  alta:    'Alta',
  normal:  'Normal',
  baixa:   'Baixa',
};

export const DAILY_HOURS_DEFAULT = 8;

// ── Helpers de texto ───────────────────────────────────────────────────

// Gera texto padrão de instrução a partir dos tipos selecionados
// Ex.: ['manutencao','troca'] → "Fazer manutenção das plantas + trocas"
export function textoObsDeTipos(tipos) {
  if (!tipos?.length) return '';
  const frases = tipos
    .map(id => TIPOS_TAREFA.find(t => t.id === id)?.frase)
    .filter(Boolean);
  if (!frases.length) return '';
  return 'Fazer ' + frases.join(' + ');
}

// ── Verificação de restrições ──────────────────────────────────────────

// Calcula o fim do expediente com base na hora de início efetiva do dia
// (primeira visita com hora_estimada, ou 07:00 default) + daily_hours
export function calcularFimDoDia(visitas, dailyHours) {
  const dh = dailyHours ?? DAILY_HOURS_DEFAULT;
  const primeiraHora = visitas
    .map(v => v.hora_estimada_chegada ? horaEmMinutos(v.hora_estimada_chegada) : null)
    .filter(x => x != null)
    .sort((a, b) => a - b)[0];
  const inicio = primeiraHora ?? (7 * 60);
  return inicio + dh * 60;
}

// Verifica restrições do cliente para uma visita (dia + janela de horário)
export function checarRestricoes(cliente, dataAgendada, horaChegada) {
  const motivos = [];
  let restricaoDia = false, restricaoHora = false;

  if (cliente?.dias_disponiveis?.length > 0) {
    const diaId = getDiaSlugUtil(dataAgendada);
    if (!cliente.dias_disponiveis.includes(diaId)) {
      restricaoDia = true;
      const dias = cliente.dias_disponiveis.map(d => DIAS_LABEL[d] ?? d).join(', ');
      motivos.push(`Cliente só atende: ${dias}`);
    }
  }

  if (horaChegada && (cliente?.janela_entrada_inicio || cliente?.janela_entrada_fim)) {
    const h = horaChegada.slice(0, 5);
    const ini = cliente.janela_entrada_inicio?.slice(0, 5) ?? null;
    const fim = cliente.janela_entrada_fim?.slice(0, 5) ?? null;
    const antes = ini != null && h < ini;
    const depois = fim != null && h > fim;
    if (antes || depois) {
      restricaoHora = true;
      if (ini && fim) {
        motivos.push(`Janela do cliente: ${ini}–${fim} · marcado ${h}`);
      } else if (ini) {
        motivos.push(`Cliente só recebe a partir das ${ini} · marcado ${h}`);
      } else {
        motivos.push(`Cliente deve ter chegado até ${fim} · marcado ${h}`);
      }
    }
  }

  return { restricaoDia, restricaoHora, motivos };
}

// Retorna o bloqueio ativo para um funcionário em uma data, se houver
export function bloqueioNoDia(bloqueios, empId, isoDate) {
  const eid = String(empId);
  return (bloqueios ?? []).find(b =>
    String(b.funcionario_id) === eid &&
    isoDate >= b.data_inicio &&
    isoDate <= b.data_fim
  );
}

// Prioridade de uma visita agendada, com base no atraso do cliente
export function calcPrioridade(cliente, dataAgendada) {
  if (!cliente?.frequencia_visita) return 'normal';
  const intervalo = FREQ_INTERVALO[cliente.frequencia_visita];
  if (!intervalo) return 'normal';
  if (!cliente.ultima_visita) return 'critica';
  const dias = diasEntre(cliente.ultima_visita, dataAgendada);
  const ratio = dias / intervalo;
  if (ratio >= 2)   return 'critica';
  if (ratio >= 1.3) return 'alta';
  if (ratio >= 0.8) return 'normal';
  return 'baixa';
}

// Calcula clientes atrasados / próximos do vencimento
export function calcClientesAtrasados(clientes, hoje) {
  const atrasado = [];
  const vencendo = [];
  clientes.forEach(c => {
    if (!c.frequencia_visita) return;
    const intervalo = FREQ_INTERVALO[c.frequencia_visita];
    if (!intervalo) return;
    if (!c.ultima_visita) {
      atrasado.push({ ...c, diasAtraso: null, esperado: null, motivo: 'sem última visita registrada' });
      return;
    }
    const dias = diasEntre(c.ultima_visita, hoje);
    const atraso = dias - intervalo;
    if (atraso > 0) {
      atrasado.push({ ...c, diasAtraso: atraso, esperado: c.ultima_visita });
    } else if (atraso >= -3) {
      vencendo.push({ ...c, diasParaVencer: -atraso, esperado: addDias(c.ultima_visita, intervalo) });
    }
  });
  atrasado.sort((a, b) => (b.diasAtraso ?? 999) - (a.diasAtraso ?? 999));
  vencendo.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
  return { atrasado, vencendo };
}

// Detecta conflitos de tempo em uma lista de visitas do dia
export function calcConflitosDia(visitas, dailyHours) {
  const sobreposicoes = [];
  const idsSobrepostos = new Set();
  const idsEstouram    = new Set();
  const ordenadas = [...visitas]
    .filter(v => v.hora_estimada_chegada)
    .sort((a, b) => (a.hora_estimada_chegada ?? '').localeCompare(b.hora_estimada_chegada ?? ''));
  const fimDia = calcularFimDoDia(visitas, dailyHours);
  let fimMin = 0;
  for (let i = 0; i < ordenadas.length; i++) {
    const v = ordenadas[i];
    const inicio = horaEmMinutos(v.hora_estimada_chegada);
    const dur    = v.duracao_estimada_min ?? 60;
    const fim    = inicio + dur;
    fimMin = Math.max(fimMin, fim);
    if (fim > fimDia) idsEstouram.add(v.id);
    if (i > 0) {
      const prev = ordenadas[i - 1];
      const inicioPrev = horaEmMinutos(prev.hora_estimada_chegada);
      const durPrev    = prev.duracao_estimada_min ?? 60;
      const fimPrev    = inicioPrev + durPrev;
      if (fimPrev > inicio) {
        sobreposicoes.push({ a: prev.id, b: v.id, atraso: fimPrev - inicio });
        idsSobrepostos.add(prev.id);
        idsSobrepostos.add(v.id);
      }
    }
  }

  const sugestoes = [];
  if (sobreposicoes.length > 0) {
    let fimAnterior = null;
    for (const v of ordenadas) {
      const inicio = horaEmMinutos(v.hora_estimada_chegada);
      const dur    = v.duracao_estimada_min ?? 60;
      const inicioSug = fimAnterior != null ? Math.max(inicio, fimAnterior) : inicio;
      sugestoes.push({
        visitaId:     v.id,
        nome:         v.clientes?.nome_empresa ?? '—',
        horaAtual:    minutosParaHora(inicio),
        horaSugerida: minutosParaHora(inicioSug),
        duracao:      dur,
        mudou:        inicioSug !== inicio,
      });
      fimAnterior = inicioSug + dur;
    }
  }

  return { sobreposicoes, estouraDia: fimMin > fimDia, fimMin, fimDia, idsSobrepostos, idsEstouram, sugestoes };
}

export function verificarConflitos(cliente, isoDate) {
  const erros = [];
  const diaId = getDiaSlugUtil(isoDate);
  if ((cliente.dias_disponiveis?.length ?? 0) > 0 && !cliente.dias_disponiveis.includes(diaId)) {
    const diasFormatados = (cliente.dias_disponiveis ?? []).map(d => DIAS_LABEL[d] ?? d).join(', ');
    erros.push(`${cliente.nome_empresa} não atende ${DIAS_NOME[diaId] ?? diaId}s · dias disponíveis: ${diasFormatados}`);
  }
  return erros;
}

export function verificarHorario(cliente, hora) {
  const avisos = [];
  if (!hora) return avisos;
  const ini = cliente.janela_entrada_inicio?.slice(0, 5) ?? null;
  const fim = cliente.janela_entrada_fim?.slice(0, 5) ?? null;
  if (!ini && !fim) return avisos;
  const antes  = ini != null && hora < ini;
  const depois = fim != null && hora > fim;
  if (antes || depois) {
    if (ini && fim) {
      avisos.push(`Janela de entrada: ${ini}–${fim} · você marcou ${hora}`);
    } else if (ini) {
      avisos.push(`Cliente só recebe a partir das ${ini} · você marcou ${hora}`);
    } else {
      avisos.push(`Cliente deve ter chegado até ${fim} · você marcou ${hora}`);
    }
  }
  return avisos;
}
