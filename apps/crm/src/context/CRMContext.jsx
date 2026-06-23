// src/context/CRMContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CRMContext = createContext(null);

// ─── Funil de Vendas (conforme CLAUDE.md) ────────────────────────────────────
export const ESTAGIOS = [
  { id: 'contato_recebido',      label: 'Contato Recebido',      cor: '#6B7280' },
  { id: 'orcamento_pendente',    label: 'Orçamento Pendente',    cor: '#F59E0B' },
  { id: 'orcamento_enviado',     label: 'Orçamento Enviado',     cor: '#3B82F6' },
  { id: 'orcamento_aprovado',    label: 'Aprovado',              cor: '#10B981' },
  { id: 'orcamento_nao_aprovado', label: 'Não Aprovado',         cor: '#EF4444' },
];

// ─── Tipos de Serviço (conforme CLAUDE.md) ───────────────────────────────────
export const TIPOS_SERVICO = {
  venda:          { label: 'Venda de Vasos e Plantas',           cor: '#8B5CF6', faturamento: 'unico' },
  manutencao:     { label: 'Manutenção de Vasos e Plantas',      cor: '#10B981', faturamento: 'recorrente' },
  reforma:        { label: 'Reforma de Vasos e Plantas',         cor: '#F59E0B', faturamento: 'unico' },
  locacao:        { label: 'Locação de Vasos e Plantas',         cor: '#3B82F6', faturamento: 'recorrente' },
  locacao_evento: { label: 'Locação para Eventos',               cor: '#EC4899', faturamento: 'unico' },
};

// ─── Canais de Origem (conforme CLAUDE.md) ───────────────────────────────────
export const CANAIS_ORIGEM = ['WhatsApp', 'E-mail', 'Telefone'];

// ─── Frequências de Visita (para serviços recorrentes) ───────────────────────
export const FREQUENCIAS_VISITA = ['Semanal', 'Quinzenal', 'Mensal', 'Pontual'];

// ─── Motivos de Perda (Tarefa 2.2) ───────────────────────────────────────────
export const MOTIVOS_PERDA = [
  'Preço Alto',
  'Concorrente Cobriu Oferta',
  'Opção por Plantas Artificiais',
  'Projeto Suspenso',
];

// ─── Helpers de data e fluxo ─────────────────────────────────────────────────
export function addDias(isoDate, dias) {
  const d = new Date(isoDate + 'T12:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

export function criarFluxoOrcamento(lead, hoje = new Date().toISOString().split('T')[0]) {
  const temVisita = lead.visitas?.length > 0;
  const t1Dias    = temVisita ? 6 : 3;
  const t1Prazo   = addDias(hoje, t1Dias);
  const t2Prazo   = addDias(t1Prazo, 3);
  const t3Prazo   = addDias(t2Prazo, 3);
  return {
    ativo: true, iniciouEm: hoje, etapaAtual: 't1', urgente: false, aguardandoResposta: false,
    t1: { prazoDias: t1Dias, prazoData: t1Prazo, status: 'pendente', prorrogacoes: [], concluidaEm: null },
    t2: { prazoDias: 3, prazoData: t2Prazo, status: 'pendente', envioWhatsapp: false, envioEmail: false, enviadoEm: null },
    t3: { prazoDias: 3, prazoData: t3Prazo, status: 'pendente', confirmadoEm: null },
    cicloAprovacao: { prazoDias: 10, historico: [] },
  };
}

export function criarFunilExecucao(hoje = new Date().toISOString().split('T')[0]) {
  return { etapa: 'materiais', dataInicio: hoje, historico: [{ etapa: 'materiais', entrou: hoje, saiu: null }] };
}

// ─── Etapas do Funil de Execução ─────────────────────────────────────────────
export const ESTAGIOS_EXECUCAO = [
  { id: 'materiais',   label: 'Lista de Materiais',        cor: '#8B5CF6' },
  { id: 'agendamento', label: 'Agendamento do Serviço',    cor: '#F59E0B' },
  { id: 'execucao',    label: 'Execução',                  cor: '#3B82F6' },
  { id: 'orientacao',  label: 'Orientações / Nota Fiscal', cor: '#10B981' },
  { id: 'pos_venda',   label: 'Acompanhamento Pós-Venda',  cor: '#6B7280' },
];

// ─── Dados Mockados ──────────────────────────────────────────────────────────
// Cobrem os 5 tipos de serviço, 3 canais de origem e bairros corporativos de SP
const LEADS_INICIAIS = [

  // ── CONTATO RECEBIDO ──────────────────────────────────────────────────────
  {
    id: 'lead-001',
    empresa: 'Advocacia Branco & Reis',
    contato: 'Fernanda Branco',
    cargo: 'Sócia-Administradora',
    telefone: '(11) 98234-5510',
    email: 'fernanda@brancoereis.com.br',
    bairro: 'Faria Lima',
    endereco: 'Av. Brigadeiro Faria Lima, 2369 – cj. 84, São Paulo/SP',
    lat: -23.5772,
    lng: -46.6844,
    estagioId: 'contato_recebido',
    tipoServico: 'locacao',
    canalOrigem: 'WhatsApp',
    quantidadeVasos: 12,
    valorEstimado: 960,        // R$ 80/vaso/mês
    frequenciaVisita: 'Mensal',
    observacoes: 'Recepção + 3 salas de reunião. Prefere folhagens largas (Costela-de-Adão).',
    dataEntrada: '2026-06-15',
    ultimoContato: '2026-06-15',
    proximoFollowUp: '2026-06-18',
    responsavel: 'Ana Carvalho',
  },
  {
    id: 'lead-002',
    empresa: 'Consultório Dra. Patrícia Leal',
    contato: 'Patrícia Leal',
    cargo: 'Proprietária',
    telefone: '(11) 97741-0023',
    email: 'dra.patricia@lealdermatologia.com.br',
    bairro: 'Jardins',
    endereco: 'R. Oscar Freire, 1010 – sala 52, São Paulo/SP',
    lat: -23.5638,
    lng: -46.6681,
    estagioId: 'contato_recebido',
    tipoServico: 'venda',
    canalOrigem: 'Telefone',
    quantidadeVasos: 6,
    valorEstimado: 1800,       // R$ 300/vaso (venda única)
    frequenciaVisita: null,
    observacoes: 'Quer vasos brancos com plantas de porte médio para sala de espera. Orçamento até R$ 2.000.',
    dataEntrada: '2026-06-14',
    ultimoContato: '2026-06-14',
    proximoFollowUp: '2026-06-17',
    responsavel: 'Carlos Mendes',
  },

  // ── ORÇAMENTO PENDENTE ────────────────────────────────────────────────────
  {
    id: 'lead-003',
    empresa: 'Contabilidade Ômega Assessoria',
    contato: 'Rogério Pimentel',
    cargo: 'Diretor Financeiro',
    telefone: '(11) 96632-8801',
    email: 'rogerio@omegacontabil.com.br',
    bairro: 'Vila Olímpia',
    endereco: 'R. Funchal, 418 – 10º andar, São Paulo/SP',
    lat: -23.5958,
    lng: -46.6859,
    estagioId: 'orcamento_pendente',
    tipoServico: 'manutencao',
    canalOrigem: 'E-mail',
    quantidadeVasos: 20,
    valorEstimado: 1400,       // R$ 70/vaso/mês
    frequenciaVisita: 'Quinzenal',
    observacoes: 'Já possui plantas no escritório (compradas em outro fornecedor). Quer apenas manutenção. Visita técnica agendada p/ 20/06.',
    dataEntrada: '2026-06-10',
    ultimoContato: '2026-06-13',
    proximoFollowUp: '2026-06-20',
    responsavel: 'Ana Carvalho',
  },
  {
    id: 'lead-004',
    empresa: 'Espaço Cowork Berrini',
    contato: 'Marcos Diniz',
    cargo: 'Gerente de Operações',
    telefone: '(11) 98905-4422',
    email: 'm.diniz@coworkberrini.com.br',
    bairro: 'Berrini',
    endereco: 'Av. das Nações Unidas, 11541 – 3º andar, São Paulo/SP',
    lat: -23.6012,
    lng: -46.6985,
    estagioId: 'orcamento_pendente',
    tipoServico: 'locacao',
    canalOrigem: 'WhatsApp',
    quantidadeVasos: 35,
    valorEstimado: 3150,       // R$ 90/vaso/mês (locação inclui manutenção)
    frequenciaVisita: 'Semanal',
    observacoes: 'Coworking com alto fluxo. Quer plantas de baixíssima manutenção entre as mesas. Frequência semanal para repor água.',
    dataEntrada: '2026-06-08',
    ultimoContato: '2026-06-12',
    proximoFollowUp: '2026-06-19',
    responsavel: 'Carlos Mendes',
  },
  {
    id: 'lead-005',
    empresa: 'Clínica SorrirBem Odontologia',
    contato: 'Dra. Camila Souza',
    cargo: 'Sócia-Diretora',
    telefone: '(11) 95500-2211',
    email: 'camila@sorrirbem.com.br',
    bairro: 'Pinheiros',
    endereco: 'R. dos Pinheiros, 352 – sala 31, São Paulo/SP',
    lat: -23.5658,
    lng: -46.6849,
    estagioId: 'orcamento_pendente',
    tipoServico: 'reforma',
    canalOrigem: 'Telefone',
    quantidadeVasos: 8,
    valorEstimado: 2400,       // R$ 300/vaso reforma
    frequenciaVisita: null,
    observacoes: 'Vasos antigos com solo degradado e plantas doentes. Quer reforma completa: troca de substrato, poda e replantio.',
    dataEntrada: '2026-06-09',
    ultimoContato: '2026-06-11',
    proximoFollowUp: '2026-06-18',
    responsavel: 'Ana Carvalho',
  },

  // ── ORÇAMENTO ENVIADO ─────────────────────────────────────────────────────
  {
    id: 'lead-006',
    empresa: 'Banco Meridional S.A.',
    contato: 'Patricia Lemos',
    cargo: 'Head of Corporate Real Estate',
    telefone: '(11) 97200-3340',
    email: 'patricia.lemos@bancomeriodional.com.br',
    bairro: 'Faria Lima',
    endereco: 'Av. Brigadeiro Faria Lima, 4058 – 14º andar, São Paulo/SP',
    lat: -23.5880,
    lng: -46.6892,
    estagioId: 'orcamento_enviado',
    tipoServico: 'locacao',
    canalOrigem: 'E-mail',
    quantidadeVasos: 60,
    valorEstimado: 6000,       // R$ 100/vaso/mês
    frequenciaVisita: 'Semanal',
    observacoes: 'Orçamento enviado em 10/06. Andar inteiro: salas executivas + corredores. Aprovação passa pelo jurídico.',
    dataEntrada: '2026-05-28',
    ultimoContato: '2026-06-10',
    proximoFollowUp: '2026-06-19',
    responsavel: 'Carlos Mendes',
    orcamento: {
      numero: 'ORC-2026-031',
      dataEnvio: '2026-06-10',
      validade: '2026-07-10',
      descricao: 'Locação de 60 vasos com manutenção semanal inclusa. Espécies: Zamioculca, Sansevieria e Aglaonema (resistentes a AC e baixa luminosidade). Troca de espécies a cada 6 meses sem custo adicional.',
      total: 6000,
    },
  },
  {
    id: 'lead-007',
    empresa: 'Evento Corporativo – Grupo Altamira',
    contato: 'Juliana Matos',
    cargo: 'Coordenadora de Eventos',
    telefone: '(11) 96100-7788',
    email: 'juliana.matos@altamiragroup.com.br',
    bairro: 'Centro',
    endereco: 'Viaduto do Chá, 15 – Centro Cultural, São Paulo/SP',
    lat: -23.5455,
    lng: -46.6388,
    estagioId: 'orcamento_enviado',
    tipoServico: 'locacao_evento',
    canalOrigem: 'WhatsApp',
    quantidadeVasos: 40,
    valorEstimado: 3200,       // R$ 80/vaso evento (único)
    frequenciaVisita: null,
    dataEntradaEvento: '2026-07-10',
    horarioEntrega: '07:00',
    horarioRetirada: '23:00',
    observacoes: 'Jantar de gala para 250 convidados. Entrega às 07h, retirada às 23h do mesmo dia. Vasos de 1,5m+ para delimitar espaços.',
    dataEntrada: '2026-06-05',
    ultimoContato: '2026-06-11',
    proximoFollowUp: '2026-06-18',
    responsavel: 'Carlos Mendes',
    orcamento: {
      numero: 'ORC-2026-029',
      dataEnvio: '2026-06-11',
      validade: '2026-06-25',
      descricao: 'Locação de 40 vasos grandes (Ficus, Dracena, Palmeira Areca) para evento de 1 dia. Inclui montagem, acompanhamento durante o evento e desmontagem.',
      total: 3200,
    },
  },
  {
    id: 'lead-008',
    empresa: 'RH Soluções Empresariais',
    contato: 'Thiago Monteiro',
    cargo: 'Gerente Administrativo',
    telefone: '(11) 97812-6600',
    email: 'thiago@rhsolucoes.com.br',
    bairro: 'Vila Olímpia',
    endereco: 'Av. Presidente Juscelino Kubitschek, 1830 – cj. 141, São Paulo/SP',
    lat: -23.5940,
    lng: -46.6830,
    estagioId: 'orcamento_enviado',
    tipoServico: 'manutencao',
    canalOrigem: 'Telefone',
    quantidadeVasos: 15,
    valorEstimado: 1125,       // R$ 75/vaso/mês
    frequenciaVisita: 'Quinzenal',
    observacoes: 'Cliente antigo de venda (2024). Quer incluir manutenção mensal. Orçamento enviado 09/06.',
    dataEntrada: '2026-06-02',
    ultimoContato: '2026-06-09',
    proximoFollowUp: '2026-06-17',
    responsavel: 'Ana Carvalho',
    orcamento: {
      numero: 'ORC-2026-028',
      dataEnvio: '2026-06-09',
      validade: '2026-07-09',
      descricao: 'Manutenção quinzenal de 15 vasos (poda, adubação, troca de substrato semestral e rega). Plantas existentes do cliente.',
      total: 1125,
    },
  },

  // ── ORÇAMENTO APROVADO ────────────────────────────────────────────────────
  {
    id: 'lead-009',
    empresa: 'Rede de Clínicas SaudePlus',
    contato: 'Bianca Oliveira',
    cargo: 'Diretora de Expansão',
    telefone: '(11) 96644-2200',
    email: 'bianca.oliveira@saudeplus.com.br',
    bairro: 'Paulista',
    endereco: 'Av. Paulista, 1374 – 9º andar, São Paulo/SP',
    lat: -23.5614,
    lng: -46.6558,
    estagioId: 'orcamento_aprovado',
    tipoServico: 'locacao',
    canalOrigem: 'E-mail',
    quantidadeVasos: 30,
    valorEstimado: 2700,       // R$ 90/vaso/mês
    frequenciaVisita: 'Quinzenal',
    observacoes: 'Contrato assinado em 05/06. Início: 01/07. 2 unidades por enquanto, expansão prevista.',
    dataEntrada: '2026-04-20',
    ultimoContato: '2026-06-05',
    proximoFollowUp: null,
    responsavel: 'Carlos Mendes',
    contrato: {
      dataInicio: '2026-07-01',
      vigenciaMeses: 12,
      indiceReajuste: 'IPCA',
      diaFaturamento: 5,
    },
  },
  {
    id: 'lead-010',
    empresa: 'Startup Village Campinas',
    contato: 'Leticia Borges',
    cargo: 'COO',
    telefone: '(19) 98820-1133',
    email: 'leticia@startupvillage.com.br',
    bairro: 'Nova Campinas',
    endereco: 'Av. José de Souza Campos, 900 – Hub Principal, Campinas/SP',
    lat: -22.9056,
    lng: -47.0608,
    estagioId: 'orcamento_aprovado',
    tipoServico: 'venda',
    canalOrigem: 'WhatsApp',
    quantidadeVasos: 25,
    valorEstimado: 8750,       // R$ 350/vaso (venda única, vasos maiores)
    frequenciaVisita: null,
    observacoes: 'Venda concluída. Entrega agendada para 22/06. Inclui montagem e orientação de cuidados básicos para equipe interna.',
    dataEntrada: '2026-05-15',
    ultimoContato: '2026-06-01',
    proximoFollowUp: '2026-06-22',
    responsavel: 'Ana Carvalho',
    contrato: null,
  },

  // ── ORÇAMENTO NÃO APROVADO ────────────────────────────────────────────────
  {
    id: 'lead-011',
    empresa: 'Escritório Braxton Advogados',
    contato: 'Roberto Braxton',
    cargo: 'Sócio-Fundador',
    telefone: '(11) 93321-0088',
    email: 'r.braxton@braxtonadv.com.br',
    bairro: 'Consolação',
    endereco: 'R. da Consolação, 3518 – 5º andar, São Paulo/SP',
    lat: -23.5558,
    lng: -46.6620,
    estagioId: 'orcamento_nao_aprovado',
    tipoServico: 'locacao',
    canalOrigem: 'Telefone',
    quantidadeVasos: 10,
    valorEstimado: 900,
    frequenciaVisita: 'Mensal',
    motivoPerda: 'Preço Alto',
    observacoes: 'Achou o valor de R$ 90/vaso/mês caro. Concorrente ofereceu R$ 65. Não havia margem para cobrir.',
    dataEntrada: '2026-05-10',
    ultimoContato: '2026-06-01',
    proximoFollowUp: null,
    responsavel: 'Carlos Mendes',
  },
  {
    id: 'lead-012',
    empresa: 'Academia FitMove',
    contato: 'Denise Ramos',
    cargo: 'Franqueada',
    telefone: '(11) 94455-7700',
    email: 'denise.ramos@fitmove.com.br',
    bairro: 'Centro',
    endereco: 'R. Direita, 200 – 2º andar, São Paulo/SP',
    lat: -23.5476,
    lng: -46.6361,
    estagioId: 'orcamento_nao_aprovado',
    tipoServico: 'manutencao',
    canalOrigem: 'WhatsApp',
    quantidadeVasos: 5,
    valorEstimado: 350,
    frequenciaVisita: 'Mensal',
    motivoPerda: 'Opção por Plantas Artificiais',
    observacoes: 'Optou por plantas artificiais por não ter equipe para acompanhar visitas técnicas mensais.',
    dataEntrada: '2026-05-22',
    ultimoContato: '2026-05-30',
    proximoFollowUp: null,
    responsavel: 'Ana Carvalho',
  },
];

// ─── Tarefas mockadas ────────────────────────────────────────────────────────
const hoje = new Date().toISOString().split('T')[0];
const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const ontem  = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const semana = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];

const TAREFAS_INICIAIS = [
  {
    id: 'tarefa-001',
    titulo: 'Enviar proposta de locação para Advocacia Branco & Reis',
    descricao: 'Preparar orçamento com 12 vasos de Costela-de-Adão para recepção e salas de reunião.',
    prioridade: 'alta',
    status: 'a_fazer',
    dataVencimento: hoje,
    leadId: 'lead-001',
    categoria: 'orcamento',
    dataCriacao: ontem,
    concluidaEm: null,
  },
  {
    id: 'tarefa-002',
    titulo: 'Visita técnica — Consultório Dra. Patrícia Leal',
    descricao: 'Avaliar estado das plantas e verificar necessidade de reposição.',
    prioridade: 'alta',
    status: 'a_fazer',
    dataVencimento: hoje,
    leadId: 'lead-002',
    categoria: 'visita',
    dataCriacao: ontem,
    concluidaEm: null,
  },
  {
    id: 'tarefa-003',
    titulo: 'Follow-up com Contabilidade Ômega Assessoria',
    descricao: 'Retornar contato sobre aprovação do orçamento de manutenção quinzenal.',
    prioridade: 'media',
    status: 'em_andamento',
    dataVencimento: amanha,
    leadId: 'lead-003',
    categoria: 'followup',
    dataCriacao: ontem,
    concluidaEm: null,
  },
  {
    id: 'tarefa-004',
    titulo: 'Solicitar NF de compra de vasos — Espaco Cowork Berrini',
    descricao: 'Solicitar nota fiscal para a compra dos vasos de cimento instalados.',
    prioridade: 'baixa',
    status: 'a_fazer',
    dataVencimento: semana,
    leadId: null,
    categoria: 'administrativo',
    dataCriacao: ontem,
    concluidaEm: null,
  },
  {
    id: 'tarefa-005',
    titulo: 'Preparar cronograma de manutenção — RH Soluções',
    descricao: 'Montar escala mensal de visitas com horários aprovados pelo cliente.',
    prioridade: 'media',
    status: 'a_fazer',
    dataVencimento: ontem,
    leadId: 'lead-005',
    categoria: 'visita',
    dataCriacao: ontem,
    concluidaEm: null,
  },
  {
    id: 'tarefa-006',
    titulo: 'Renovar contrato — Tech Futures',
    descricao: 'Contrato de locação vence em 30 dias. Iniciar processo de renovação.',
    prioridade: 'alta',
    status: 'a_fazer',
    dataVencimento: semana,
    leadId: 'lead-006',
    categoria: 'administrativo',
    dataCriacao: ontem,
    concluidaEm: null,
  },
  {
    id: 'tarefa-007',
    titulo: 'Confirmar entrega de vasos para evento',
    descricao: 'Confirmar logística de entrega e retirada para o evento da Indústria Faruk & Tanaka.',
    prioridade: 'alta',
    status: 'concluida',
    dataVencimento: ontem,
    leadId: 'lead-009',
    categoria: 'visita',
    dataCriacao: ontem,
    concluidaEm: ontem,
  },
  {
    id: 'tarefa-008',
    titulo: 'Atualizar planilha de clientes ativos',
    descricao: 'Revisar e atualizar controle interno com novos clientes do mês.',
    prioridade: 'baixa',
    status: 'concluida',
    dataVencimento: ontem,
    leadId: null,
    categoria: 'administrativo',
    dataCriacao: ontem,
    concluidaEm: ontem,
  },
];

// ─── Provider ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'crm-verde-leads';
const STORAGE_KEY_TAREFAS = 'crm-verde-tarefas';

function carregarLeads() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) return JSON.parse(salvo);
  } catch {}
  return LEADS_INICIAIS;
}

function carregarTarefas() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_TAREFAS);
    if (salvo) return JSON.parse(salvo);
  } catch {}
  return TAREFAS_INICIAIS;
}

export function CRMProvider({ children }) {
  const [leads, setLeads] = useState(carregarLeads);
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const [dragLeadId, setDragLeadId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefas, setTarefas] = useState(carregarTarefas);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TAREFAS, JSON.stringify(tarefas));
  }, [tarefas]);

  // Auto-inicializa fluxoOrcamento (pendente/enviado) e funilExecucao (aprovado)
  // Roda apenas uma vez na montagem, pois os dados iniciais são estáticos.
  // Atualizações posteriores de leads já incluem os campos obrigatórios.
  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0];
    setLeads((prev) => {
      let changed = false;
      const updated = prev.map((l) => {
        let newL = l;
        if (['orcamento_pendente', 'orcamento_enviado'].includes(l.estagioId) && !l.fluxoOrcamento) {
          newL = { ...newL, fluxoOrcamento: criarFluxoOrcamento(l, hoje) };
          changed = true;
        }
        if (l.estagioId === 'orcamento_aprovado' && !l.funilExecucao) {
          newL = { ...newL, funilExecucao: criarFunilExecucao(hoje) };
          changed = true;
        }
        return newL;
      });
      return changed ? updated : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move um lead para um novo estágio do funil
  const moverLead = useCallback((leadId, novoEstagioId) => {
    const hoje = new Date().toISOString().split('T')[0];
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== leadId) return lead;
        const novoEstagio = ESTAGIOS.find((e) => e.id === novoEstagioId);
        const entrada = {
          id: `h-${Date.now()}`,
          tipo: 'estagio',
          descricao: `Movido para ${novoEstagio?.label ?? novoEstagioId}`,
          data: hoje,
        };
        return {
          ...lead,
          estagioId: novoEstagioId,
          historico: [...(lead.historico ?? []), entrada],
        };
      })
    );
    setDragLeadId(null);
  }, []);

  // Atualiza qualquer campo(s) de um lead existente
  const atualizarLead = useCallback((leadId, atualizacoes) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, ...atualizacoes } : lead
      )
    );
  }, []);

  // Adiciona novo lead (estagioId padrão: contato_recebido)
  const adicionarLead = useCallback((novoLead) => {
    const lead = {
      estagioId: 'contato_recebido',
      dataEntrada: new Date().toISOString().split('T')[0],
      ...novoLead,
      id: `lead-${Date.now()}`,
    };
    setLeads((prev) => [lead, ...prev]);
    return lead;
  }, []);

  // Remove um lead
  const removerLead = useCallback((leadId) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  }, []);

  // Move lead dentro do Funil de Execução
  const moverFunilExecucao = useCallback((leadId, novaEtapa) => {
    const hoje = new Date().toISOString().split('T')[0];
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const historico = (l.funilExecucao?.historico ?? []).map((h) =>
          h.saiu === null ? { ...h, saiu: hoje } : h
        );
        return { ...l, funilExecucao: { ...(l.funilExecucao ?? criarFunilExecucao(hoje)), etapa: novaEtapa, historico: [...historico, { etapa: novaEtapa, entrou: hoje, saiu: null }] } };
      })
    );
  }, []);

  // Filtra leads por estágio (usado por KanbanColumn)
  const leadsPorEstagio = useCallback(
    (estagioId) => leads.filter((l) => l.estagioId === estagioId),
    [leads]
  );

  // Clientes ativos para o RoutePlanner: aprovados com serviço recorrente (exclui manutenção pontual)
  const clientesAtivos = leads.filter(
    (l) =>
      l.estagioId === 'orcamento_aprovado' &&
      TIPOS_SERVICO[l.tipoServico]?.faturamento === 'recorrente' &&
      l.frequenciaVisita !== 'Pontual'
  );

  // Modal de orçamento
  const abrirModal = useCallback((lead) => {
    setLeadSelecionado(lead);
    setModalAberto(true);
  }, []);

  const fecharModal = useCallback(() => {
    setLeadSelecionado(null);
    setModalAberto(false);
  }, []);

  // ── Ações de tarefas ──────────────────────────────────────────────────────
  const adicionarTarefa = useCallback((dados) => {
    setTarefas((prev) => [
      {
        status: 'a_fazer',
        prioridade: 'media',
        categoria: 'geral',
        leadId: null,
        descricao: '',
        concluidaEm: null,
        dataCriacao: new Date().toISOString().split('T')[0],
        ...dados,
        id: `tarefa-${Date.now()}`,
      },
      ...prev,
    ]);
  }, []);

  const atualizarTarefa = useCallback((id, delta) => {
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, ...delta } : t)));
  }, []);

  const removerTarefa = useCallback((id) => {
    setTarefas((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleConcluirTarefa = useCallback((id) => {
    setTarefas((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const jaConcluida = t.status === 'concluida';
        return {
          ...t,
          status: jaConcluida ? 'a_fazer' : 'concluida',
          concluidaEm: jaConcluida ? null : new Date().toISOString().split('T')[0],
        };
      })
    );
  }, []);

  // Métricas rápidas do funil
  const metricas = {
    totalLeads: leads.length,
    valorPipeline: leads
      .filter((l) => !['orcamento_aprovado', 'orcamento_nao_aprovado'].includes(l.estagioId))
      .reduce((s, l) => s + (l.valorEstimado ?? 0), 0),
    recorrenciaMensal: leads
      .filter(
        (l) =>
          l.estagioId === 'orcamento_aprovado' &&
          TIPOS_SERVICO[l.tipoServico]?.faturamento === 'recorrente' &&
          l.frequenciaVisita !== 'Pontual'
      )
      .reduce((s, l) => s + (l.valorEstimado ?? 0), 0),
    taxaConversao: (() => {
      const finalizados = leads.filter((l) =>
        ['orcamento_aprovado', 'orcamento_nao_aprovado'].includes(l.estagioId)
      ).length;
      const aprovados = leads.filter((l) => l.estagioId === 'orcamento_aprovado').length;
      return finalizados > 0 ? Math.round((aprovados / finalizados) * 100) : 0;
    })(),
  };

  return (
    <CRMContext.Provider
      value={{
        // Estado
        leads,
        leadSelecionado,
        modalAberto,
        clientesAtivos,
        metricas,
        dragLeadId,
        setDragLeadId,
        // Constantes (úteis nos componentes filhos)
        ESTAGIOS,
        TIPOS_SERVICO,
        CANAIS_ORIGEM,
        FREQUENCIAS_VISITA,
        MOTIVOS_PERDA,
        // Constantes execução
        ESTAGIOS_EXECUCAO,
        // Ações de leads
        moverLead,
        moverFunilExecucao,
        atualizarLead,
        adicionarLead,
        removerLead,
        leadsPorEstagio,
        abrirModal,
        fecharModal,
        // Tarefas
        tarefas,
        adicionarTarefa,
        atualizarTarefa,
        removerTarefa,
        toggleConcluirTarefa,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM deve ser usado dentro de <CRMProvider>');
  return ctx;
}
