// src/utils/regaHelpers.js
// Gerador de agenda de rega da semana (Escala — Fase B). Implementa o
// Passo 1-3 do fluxo manual (Tatyana/Rafael): a agenda nova começa como
// cópia literal da agenda REAL da semana anterior (não existe uma
// "distribuição padrão" separada — confirmado com o Fernando), da qual se
// removem:
//   - troca/reforma/evento — não são rega padrão, quem decide se repetem é
//     o planejador de troca (Mapa) ou o próprio gestor, não essa cópia
//   - tarefas avulsas/lead — sem cliente_id, não têm frequência pra checar
//   - quinzenais — por definição, se apareceram na semana copiada (a
//     imediatamente anterior), não voltam essa semana (só daqui a 2 semanas)
//   - pontuais que já tiveram QUALQUER visita no mês corrente (calendário,
//     não "semana")
import { diasEntre, addDias } from './dateUtils';

const TIPOS_NAO_REGA = ['troca', 'reforma', 'evento'];

function ehRega(tiposTarefa) {
  const tipos = tiposTarefa ?? [];
  return !tipos.some(t => TIPOS_NAO_REGA.includes(t));
}

// visitasDoMesPorCliente: Map<clienteId, count> — nº de visitas (qualquer
// tipo, status não cancelado/faltou) já registradas no mês de destino.
export function gerarRegaDaSemana({
  agendaSemanaAnterior, clientesPorId, visitasDoMesPorCliente,
  semanaAnteriorBase, semanaNovaBase,
}) {
  const excluidos = { avulsa: [], troca: [], quinzenal: [], pontual: [] };
  const linhas = [];

  for (const v of agendaSemanaAnterior) {
    if (!v.cliente_id) { excluidos.avulsa.push(v); continue; }
    if (!ehRega(v.tipos_tarefa)) { excluidos.troca.push(v); continue; }

    const cliente = clientesPorId.get(v.cliente_id);
    const freq = cliente?.frequencia_visita;
    if (freq === 'quinzenal') { excluidos.quinzenal.push(v); continue; }
    if (freq === 'pontual') {
      const jaTeveEsseMes = (visitasDoMesPorCliente.get(v.cliente_id) ?? 0) > 0;
      if (jaTeveEsseMes) { excluidos.pontual.push(v); continue; }
    }

    const offsetDias = diasEntre(semanaAnteriorBase, v.data_agendada);
    linhas.push({
      cliente_id:            v.cliente_id,
      funcionario_id:        v.funcionario_id,
      cliente_servico_id:    v.cliente_servico_id ?? null,
      data_agendada:         addDias(semanaNovaBase, offsetDias),
      hora_estimada_chegada: v.hora_estimada_chegada ?? null,
      duracao_estimada_min:  v.duracao_estimada_min ?? null,
      tipos_tarefa:          v.tipos_tarefa ?? null,
      observacoes_gestor:    v.observacoes_gestor ?? null,
      ordem_rota:            v.ordem_rota ?? 0,
      status:                'rascunho',
      // preservado só pra UI (não vai pro banco — ModalGerarRega remove
      // antes do insert)
      _origem: { nome_empresa: cliente?.nome_empresa, dataOrigem: v.data_agendada },
    });
  }

  return { linhas, excluidos };
}
