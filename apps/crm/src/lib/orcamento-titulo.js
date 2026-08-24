// src/lib/orcamento-titulo.js

const NOMES = {
  venda:       'Venda e instalação',
  reforma:     'Reforma',
  locacao:     'Locação',
  'manut-rec': 'Manutenção',
  'manut-pont':'Manutenção Pontual',
  eventos:     'Locação para Eventos',
  outros:      'Serviços Diversos',
};

// Adapter: slugs do CRM → slugs do gerador/preview
const CRM_PARA_GERADOR = { manutencao: 'manut-rec', locacao_evento: 'eventos' };
export function normalizarTiposServico(tipos) {
  return (Array.isArray(tipos) ? tipos : [tipos].filter(Boolean))
    .map(t => CRM_PARA_GERADOR[t] ?? t);
}

export function gerarTituloAutomatico(tipos) {
  const arr = normalizarTiposServico(tipos);
  const nomes = arr.map(t => NOMES[t]).filter(Boolean);
  if (!nomes.length) return 'Proposta Comercial';

  const ultimo = nomes.pop();
  const prefixo = nomes.length ? `${nomes.join(', ')} e ${ultimo}` : ultimo;
  return `Orçamento – ${prefixo} de vasos e plantas`;
}
