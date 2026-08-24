// src/lib/orcamento-templates.js
// Descrições padrão por tipo de serviço — fallback hardcoded + fetch do banco.

import { supabase } from './supabase';
import { normalizarTiposServico } from './orcamento-titulo';

export const DESCRICOES_FALLBACK = {
  venda: [
    'Fornecimento e instalação das espécies ornamentais selecionadas',
    'Vasos com manta de bidim, argila expandida e casca de pinus polida',
    'Substratos, vitaminas e aminoácidos para desenvolvimento das espécies',
    'Prato coletor de água incluso em todos os vasos de chão',
    'Aplicação de fertilizantes e estabilizantes nas plantas',
    'Frete e instalação inclusos',
  ],
  reforma: [
    'Remoção das espécies antigas e do substrato',
    'Preenchimento interno com manta de bidim e argila expandida',
    'Instalação das novas espécies em potes individuais para cada muda',
    'Utilização do vaso do cliente como cachepô (não será plantado)',
    'Forração e acabamento com casca de pinus polida e tratada',
    'Frete e mão de obra inclusos',
  ],
  locacao: [
    'Locação de vasos e plantas ornamentais em regime mensal',
    'Manutenção recorrente inclusa (rega, poda, adubação, limpeza)',
    'Reposição ilimitada de espécies em caso de morte ou dano',
    'Retirada dos vasos ao final do contrato sem custo adicional',
    'Frete inclusos',
  ],
  'manut-rec': [
    'Visitas técnicas recorrentes conforme frequência contratada',
    'Rega, poda e limpeza das folhagens',
    'Adubação e aplicação de fertilizantes',
    'Verificação de pragas e doenças, com tratamento fitossanitário',
    'Substituição do substrato quando necessário',
    'Aplicação de vitaminas e aminoácidos',
    'Relatório fotográfico das visitas',
    'Comunicação direta com responsável do cliente',
    'Frete e mão de obra inclusos',
  ],
  'manut-pont': [
    'Visita técnica única para diagnóstico e cuidado das plantas',
    'Rega, poda, limpeza e adubação',
    'Aplicação de fertilizantes e vitaminas',
    'Verificação e tratamento fitossanitário',
    'Relatório fotográfico da visita',
    'Frete inclusos',
  ],
  eventos: [
    'Locação de vasos e plantas ornamentais para o período do evento',
    'Entrega, montagem no local e retirada ao final',
    'Frete de entrega e retirada inclusos',
    'Suporte durante o evento (mediante contratação)',
  ],
  outros: [],
};

// Busca templates do banco para os tipos solicitados.
// Retorna mapa { tipo: string[] }. Tipos não encontrados ficam com fallback.
export async function carregarTemplates(tipos) {
  if (!tipos?.length) return {};
  const tiposNorm = normalizarTiposServico(tipos);
  try {
    const { data } = await supabase
      .from('orcamento_templates_servico')
      .select('tipo_servico, descricoes')
      .in('tipo_servico', tiposNorm);

    const map = {};
    (data ?? []).forEach(row => {
      map[row.tipo_servico] = row.descricoes ?? [];
    });
    return map;
  } catch {
    return {};
  }
}

// Monta lista de bullets deduplicada para os tipos, mesclando DB + fallback.
// dbTemplates: resultado de carregarTemplates() — pode ser {} se ainda carregando.
export function montarBullets(tipos, dbTemplates, dadosServico) {
  const tiposNorm = normalizarTiposServico(tipos ?? []);
  const seen = new Set();
  const bullets = [];

  for (const tipo of tiposNorm) {
    const descricoes = dbTemplates[tipo] ?? DESCRICOES_FALLBACK[tipo] ?? [];
    for (const d of descricoes) {
      if (!seen.has(d)) {
        seen.add(d);
        bullets.push(d);
      }
    }
  }

  // Adições dinâmicas baseadas nos dadosServico
  if (dadosServico) {
    const {
      frequencia, dataEntrega, dataRetirada, reposicao, comReposicao, limiteMensalReposicao,
      vasosContemplados, descontoLocalizacao,
      estacionamento, estacionamentoValorHora, estacionamentoHoras,
      trabalhoNoturno, trabalhoNoturnoFuncionarios, trabalhoNoturnoCusto,
    } = dadosServico;

    const hasLocacao   = tiposNorm.includes('locacao');
    const hasManutRec  = tiposNorm.includes('manut-rec');
    const hasManutPont = tiposNorm.includes('manut-pont');
    const hasEventos   = tiposNorm.includes('eventos');

    if (frequencia && (hasManutRec || hasLocacao)) {
      const bullet = `Frequência de visita: ${frequencia}`;
      if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
    }

    // Reposição — suporte ao novo formato (reposicao.ativa) e legado (comReposicao)
    const repAtiva = reposicao?.ativa ?? comReposicao;
    if (repAtiva && hasManutRec && !hasLocacao) {
      const repTipo = reposicao?.tipo ?? (limiteMensalReposicao ? 'quantidade' : 'ilimitada');
      const qtd = reposicao?.quantidadeMensal ?? limiteMensalReposicao;
      const bullet = repTipo === 'quantidade' && qtd
        ? `Reposição de plantas: até ${qtd} por mês`
        : 'Reposição de plantas ilimitada inclusa';
      if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
    }

    if (hasEventos && dataEntrega) {
      const [y, m, d] = dataEntrega.split('-');
      const bullet = `Data de entrega: ${d}/${m}/${y}`;
      if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
    }
    if (hasEventos && dataRetirada) {
      const [y, m, d] = dataRetirada.split('-');
      const bullet = `Data de retirada: ${d}/${m}/${y}`;
      if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
    }

    if (vasosContemplados?.trim() && (hasManutRec || hasLocacao || hasManutPont)) {
      const bullet = `Vasos contemplados: ${vasosContemplados.trim()}`;
      if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
    }

    if (descontoLocalizacao && hasManutRec) {
      const bullet = 'Desconto de localização aplicado (mesmo prédio/condomínio)';
      if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
    }

    if (estacionamento && hasEventos) {
      const total = (estacionamentoValorHora ?? 0) * (estacionamentoHoras ?? 0);
      if (total > 0) {
        const bullet = `Custo de estacionamento: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}`;
        if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
      }
    }

    if (trabalhoNoturno && hasEventos) {
      const total = (trabalhoNoturnoFuncionarios ?? 1) * (trabalhoNoturnoCusto ?? 150);
      if (total > 0) {
        const bullet = `Adicional noturno: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}`;
        if (!seen.has(bullet)) { seen.add(bullet); bullets.push(bullet); }
      }
    }
  }

  return bullets;
}
