// src/utils/trocaHelpers.js
// Lógica do ciclo mensal de trocas (Planejador de Troca — Mapa, Fase 2).
// Baseado no fluxo real explicado pela Tatyana/Rafael: rega é contínua e não
// entra aqui; troca de orquídea é revisada nas semanas 1 e 3 do mês, troca
// geral (Manutenção com troca / Locação) nas semanas 2 e 4 — a 4 também
// acumula solicitações avulsas que forem surgindo.
import { getSemana, diasEntre } from './dateUtils';

// Semana do ciclo (1-4), a partir da segunda-feira da semana de referência.
// Meses com mais de 28 dias acumulam a sobra na semana 4 (mesma semana das
// solicitações avulsas — funciona como "semana de fechamento" do ciclo).
export function calcSemanaCiclo(dataIso) {
  const [segunda] = getSemana(dataIso);
  const dia = Number(segunda.slice(8, 10));
  return Math.min(4, Math.ceil(dia / 7));
}

export function ehSemanaOrquidea(semanaCiclo) {
  return semanaCiclo === 1 || semanaCiclo === 3;
}

// "Locação" entra na troca geral porque o contrato já inclui manutenção —
// confirmado com o Fernando, não é suposição.
const GRUPOS_TROCA_GERAL = ['Manutenção com troca', 'Locação'];

function porte(cliente) {
  return (cliente.cliente_servicos ?? [])
    .filter(cs => cs.ativo)
    .reduce((s, cs) => s + (Number(cs.valor_mensal) || 0), 0);
}

// Mapa clienteId → data (ISO) da troca mais recente, a partir do histórico
// de agenda (linhas com tipos_tarefa contendo 'troca'). Ignora
// cancelado/faltou — não conta como troca de fato realizada.
export function ultimaTrocaPorClienteMap(agendaTrocas) {
  const mapa = new Map();
  for (const v of agendaTrocas) {
    if (!v.cliente_id) continue;
    if (v.status === 'cancelado' || v.status === 'faltou') continue;
    const atual = mapa.get(v.cliente_id);
    if (!atual || v.data_agendada > atual) mapa.set(v.cliente_id, v.data_agendada);
  }
  return mapa;
}

// Candidatos a troca da semana do ciclo — não filtra ninguém "de fora" por
// intervalo (o intervalo padrão real ainda não foi confirmado com a
// Tatyana/Rafael); em vez disso, ordena por quem está há mais tempo sem
// trocar (nunca trocou vem primeiro), com porte como critério de desempate,
// e deixa a decisão final de quem entra pra quem está usando a ferramenta.
export function candidatosTroca({ clientes, ultimaTrocaPorCliente, semanaCiclo, hojeIso }) {
  const orquidea = ehSemanaOrquidea(semanaCiclo);
  const elegiveis = clientes.filter(c =>
    orquidea ? !!c.tem_orquidea : GRUPOS_TROCA_GERAL.includes(c.grupo_servico)
  );

  return elegiveis
    .map(c => {
      const ultima = ultimaTrocaPorCliente.get(c.id) ?? null;
      const diasDesdeTroca = ultima ? diasEntre(ultima, hojeIso) : null;
      return { ...c, ultimaTroca: ultima, diasDesdeTroca, porte: porte(c) };
    })
    .sort((a, b) => {
      const da = a.diasDesdeTroca ?? Infinity;
      const db = b.diasDesdeTroca ?? Infinity;
      if (da !== db) return db - da;
      return b.porte - a.porte;
    });
}
