// src/context/CRMContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CRMContext = createContext(null);

// Mapeamento das frequências (label do lead → slug do banco)
const FREQ_LEAD_TO_DB = {
  Semanal:   'semanal',
  Quinzenal: 'quinzenal',
  Mensal:    'mensal',
  Pontual:   'pontual',
};

// Mapeamento p/ clientes.frequencia_visita (mais granular)
const FREQ_LEAD_TO_VISITA = {
  Semanal:   '1x_semana',
  Quinzenal: 'quinzenal',
  Mensal:    'mensal',
};

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


// ─── Persistência ────────────────────────────────────────────────────────────
// Fonte de verdade: Supabase (tabelas public.leads e public.tarefas).
// localStorage é apenas cache local — usado para render inicial rápido e
// como fallback quando o Supabase estiver indisponível.
const STORAGE_KEY = 'crm-verde-leads';
const STORAGE_KEY_TAREFAS = 'crm-verde-tarefas';

// Campos "core" do lead que viram colunas dedicadas na tabela. O restante
// (fluxoOrcamento, funilExecucao, historico, orcamentoAnexos, visitas etc.)
// vai para a coluna JSONB `dados` para permitir evolução sem migration.
const LEAD_CORE_FIELDS = [
  'empresa', 'contato', 'cargo', 'telefone', 'email',
  'bairro', 'endereco', 'lat', 'lng',
  'estagioId', 'tiposServico', 'canalOrigem',
  'quantidadeVasos', 'valorEstimado', 'frequenciaVisita',
  'dataEntrada', 'ultimoContato', 'proximoFollowUp',
  'responsavel', 'observacoes', 'motivoPerda', 'clienteSupabaseId',
];

// Normaliza acesso ao array de tipos: aceita `tiposServico` (novo, array),
// `tipoServico` (legado, string) ou vazio. Usar em todo lugar que lê o campo.
export function getTiposServico(lead) {
  if (!lead) return [];
  if (Array.isArray(lead.tiposServico)) return lead.tiposServico.filter(Boolean);
  if (Array.isArray(lead.tipoServico))  return lead.tipoServico.filter(Boolean);
  if (lead.tipoServico) return [lead.tipoServico];
  return [];
}

// Retorna o tipo "primário" (primeiro do array) — usado quando precisa de um
// só (ex: promoverParaCliente cria N contratos, mas cor de card é do primário).
export function getTipoPrimario(lead) {
  return getTiposServico(lead)[0] ?? null;
}

const camelToSnake = (s) => s.replace(/[A-Z]/g, (l) => '_' + l.toLowerCase());
const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

function leadToRow(lead) {
  const row = {};
  const dados = {};
  Object.entries(lead).forEach(([k, v]) => {
    if (k === 'id') return; // id gerenciado pelo Supabase
    // Legado: `tipoServico` (string) foi substituído por `tiposServico` (array).
    // Nunca gravar o campo legado — normaliza pra array.
    if (k === 'tipoServico') return;
    if (LEAD_CORE_FIELDS.includes(k)) row[camelToSnake(k)] = v ?? null;
    else dados[k] = v;
  });
  // Sempre gravar tipos_servico como array (mesmo vazio) para evitar NULL na coluna
  row.tipos_servico = getTiposServico(lead);
  row.dados = dados;
  return row;
}

function rowToLead(row) {
  const lead = { id: row.id };
  Object.entries(row).forEach(([k, v]) => {
    if (k === 'id' || k === 'created_at' || k === 'updated_at') return;
    if (k === 'dados') Object.assign(lead, v || {});
    else lead[snakeToCamel(k)] = v;
  });
  // Normaliza: garantir que tiposServico exista como array
  lead.tiposServico = getTiposServico(lead);
  return lead;
}

function tarefaToRow(t) {
  return {
    titulo: t.titulo,
    descricao: t.descricao ?? null,
    prioridade: t.prioridade ?? 'media',
    status: t.status ?? 'a_fazer',
    categoria: t.categoria ?? 'geral',
    data_vencimento: t.dataVencimento ?? null,
    data_criacao: t.dataCriacao ?? new Date().toISOString().split('T')[0],
    concluida_em: t.concluidaEm ?? null,
    lead_id: t.leadId ?? null,
  };
}

function rowToTarefa(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    prioridade: row.prioridade,
    status: row.status,
    categoria: row.categoria,
    dataVencimento: row.data_vencimento,
    dataCriacao: row.data_criacao,
    concluidaEm: row.concluida_em,
    leadId: row.lead_id,
  };
}

function carregarCache(key) {
  try {
    const salvo = localStorage.getItem(key);
    if (salvo) return JSON.parse(salvo);
  } catch {}
  return [];
}

export function CRMProvider({ children }) {
  const [leads, setLeads] = useState(() => carregarCache(STORAGE_KEY));
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const [dragLeadId, setDragLeadId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [tarefas, setTarefas] = useState(() => carregarCache(STORAGE_KEY_TAREFAS));

  // Bootstrap: puxa leads e tarefas do Supabase ao montar. Se falhar (offline
  // ou tabela indisponível), mantém o cache local carregado no init.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('leads').select('*').order('created_at', { ascending: false });
      if (!error && data) setLeads(data.map(rowToLead));
    })();
    (async () => {
      const { data, error } = await supabase
        .from('tarefas').select('*').order('created_at', { ascending: false });
      if (!error && data) setTarefas(data.map(rowToTarefa));
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  // Listener global: recebe do gerador-orcamento (aberto em outra aba) o
  // snapshot HTML da proposta gerada. Anexa direto no lead correspondente,
  // funcionando mesmo se o ModalOrcamento estiver fechado.
  useEffect(() => {
    function onMsg(ev) {
      const msg = ev.data;
      if (!msg || msg.type !== 'verde-proposta-gerada') return;
      if (!msg.leadId || !msg.html || !msg.orcNum) return;

      const b64 = btoa(unescape(encodeURIComponent(msg.html)));
      const novoAnexo = {
        nome:    `Proposta ${msg.orcNum}.html`,
        tipo:    'text/html',
        tamanho: msg.html.length,
        dados:   `data:text/html;charset=utf-8;base64,${b64}`,
        origem:  'gerador',
      };

      setLeads((prev) => {
        const idx = prev.findIndex((l) => String(l.id) === String(msg.leadId));
        if (idx < 0) return prev;
        const anexos = prev[idx].orcamentoAnexos ?? [];
        if (anexos.some((a) => a.nome === novoAnexo.nome)) return prev;
        const atualizado = { ...prev[idx], orcamentoAnexos: [...anexos, novoAnexo] };
        // Persiste no Supabase
        persistLead(atualizado.id, atualizado);
        // Se o modal está aberto no mesmo lead, atualiza a referência selecionada
        // pra o ModalOrcamento renderizar o anexo novo imediatamente.
        setLeadSelecionado((cur) => (cur && String(cur.id) === String(msg.leadId) ? atualizado : cur));
        const copy = [...prev];
        copy[idx] = atualizado;
        return copy;
      });
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TAREFAS, JSON.stringify(tarefas));
  }, [tarefas]);

  // Helper: persiste no Supabase em background. Loga erros mas não reverte o
  // state — o UI fica em modo otimista para responsividade.
  async function persistLead(leadId, patchLead) {
    const row = leadToRow(patchLead);
    const { error } = await supabase.from('leads').update(row).eq('id', leadId);
    if (error) console.warn('[CRM] persistLead falhou:', error.message);
  }

  // Move um lead para um novo estágio do funil
  const moverLead = useCallback((leadId, novoEstagioId) => {
    const hoje = new Date().toISOString().split('T')[0];
    let leadAtualizado = null;
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
        leadAtualizado = {
          ...lead,
          estagioId: novoEstagioId,
          historico: [...(lead.historico ?? []), entrada],
        };
        // Auto-inicializa fluxo/funil quando entra em estágio relevante
        if (['orcamento_pendente', 'orcamento_enviado'].includes(novoEstagioId) && !leadAtualizado.fluxoOrcamento) {
          leadAtualizado.fluxoOrcamento = criarFluxoOrcamento(leadAtualizado, hoje);
        }
        if (novoEstagioId === 'orcamento_aprovado' && !leadAtualizado.funilExecucao) {
          leadAtualizado.funilExecucao = criarFunilExecucao(hoje);
        }
        return leadAtualizado;
      })
    );
    setDragLeadId(null);
    if (leadAtualizado) persistLead(leadId, leadAtualizado);
  }, []);

  // Atualiza qualquer campo(s) de um lead existente
  const atualizarLead = useCallback((leadId, atualizacoes) => {
    let leadAtualizado = null;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== leadId) return lead;
        leadAtualizado = { ...lead, ...atualizacoes };
        return leadAtualizado;
      })
    );
    if (leadAtualizado) persistLead(leadId, leadAtualizado);
  }, []);

  // Adiciona novo lead (estagioId padrão: contato_recebido).
  // Insere no Supabase e usa o id retornado. Se falhar, cai em id local temporário.
  const adicionarLead = useCallback(async (novoLead) => {
    const base = {
      estagioId: 'contato_recebido',
      dataEntrada: new Date().toISOString().split('T')[0],
      ...novoLead,
    };
    const row = leadToRow(base);
    const { data, error } = await supabase.from('leads').insert(row).select().single();
    if (error) {
      console.warn('[CRM] adicionarLead falhou, usando id local:', error.message);
      const lead = { ...base, id: `lead-local-${Date.now()}` };
      setLeads((prev) => [lead, ...prev]);
      return lead;
    }
    const lead = rowToLead(data);
    setLeads((prev) => [lead, ...prev]);
    return lead;
  }, []);

  // Remove um lead
  const removerLead = useCallback((leadId) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    supabase.from('leads').delete().eq('id', leadId).then(({ error }) => {
      if (error) console.warn('[CRM] removerLead falhou:', error.message);
    });
  }, []);

  // Promove um lead aprovado a cliente no Supabase (clientes + cliente_servicos)
  // Retorna { ok, clienteId?, error? }. Marca o lead com { clienteSupabaseId }
  // para não permitir promover de novo.
  const promoverParaCliente = useCallback(async (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return { ok: false, error: 'Lead não encontrado' };
    if (lead.clienteSupabaseId) return { ok: false, error: 'Este lead já foi promovido' };

    const hoje = new Date().toISOString().split('T')[0];
    const cliente = {
      nome_empresa:        lead.empresa,
      contato_nome:        lead.contato ?? null,
      contato_telefone:    lead.telefone ?? null,
      contato_email:       lead.email ?? null,
      endereco:            lead.endereco ?? '',
      bairro:              lead.bairro ?? null,
      lat:                 lead.lat ?? 0,
      lng:                 lead.lng ?? 0,
      observacoes:         lead.observacoes ?? null,
      frequencia_visita:   FREQ_LEAD_TO_VISITA[lead.frequenciaVisita] ?? null,
      ativo:               true,
      data_inicio_contrato: hoje,
    };

    const { data: cli, error: e1 } = await supabase
      .from('clientes').insert(cliente).select().single();
    if (e1) return { ok: false, error: e1.message };

    // Cria um contrato para cada tipo que faça sentido (locacao, manutencao, venda).
    // Reforma/evento são one-shot — não criam contrato recorrente.
    const tiposParaContrato = getTiposServico(lead)
      .filter((t) => ['locacao', 'manutencao', 'venda'].includes(t));
    for (const tipo of tiposParaContrato) {
      const { error: e2 } = await supabase.from('cliente_servicos').insert({
        cliente_id: cli.id,
        tipo_servico: tipo,
        frequencia: FREQ_LEAD_TO_DB[lead.frequenciaVisita] ?? 'pontual',
        quantidade_vasos: lead.quantidadeVasos ?? null,
        valor_mensal: lead.valorEstimado ?? null,
        ativo: true,
      });
      if (e2) console.warn(`Contrato (${tipo}) não criado:`, e2.message);
    }

    let leadAtualizado = null;
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      leadAtualizado = {
        ...l,
        clienteSupabaseId: cli.id,
        historico: [...(l.historico ?? []), {
          id: `h-${Date.now()}`,
          tipo: 'promocao',
          descricao: `Promovido a Cliente (id ${cli.id.slice(0, 8)}…)`,
          data: hoje,
        }],
      };
      return leadAtualizado;
    }));
    if (leadAtualizado) persistLead(leadId, leadAtualizado);

    return { ok: true, clienteId: cli.id };
  }, [leads]);

  // Move lead dentro do Funil de Execução
  const moverFunilExecucao = useCallback((leadId, novaEtapa) => {
    const hoje = new Date().toISOString().split('T')[0];
    let leadAtualizado = null;
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const historico = (l.funilExecucao?.historico ?? []).map((h) =>
          h.saiu === null ? { ...h, saiu: hoje } : h
        );
        leadAtualizado = { ...l, funilExecucao: { ...(l.funilExecucao ?? criarFunilExecucao(hoje)), etapa: novaEtapa, historico: [...historico, { etapa: novaEtapa, entrou: hoje, saiu: null }] } };
        return leadAtualizado;
      })
    );
    if (leadAtualizado) persistLead(leadId, leadAtualizado);
  }, []);

  // Filtra leads por estágio (usado por KanbanColumn)
  const leadsPorEstagio = useCallback(
    (estagioId) => leads.filter((l) => l.estagioId === estagioId),
    [leads]
  );

  // Clientes ativos para o RoutePlanner: aprovados com pelo menos um serviço
  // recorrente (exclui casos totalmente pontuais).
  const clientesAtivos = leads.filter(
    (l) =>
      l.estagioId === 'orcamento_aprovado' &&
      getTiposServico(l).some((t) => TIPOS_SERVICO[t]?.faturamento === 'recorrente') &&
      l.frequenciaVisita !== 'Pontual'
  );

  // Modal de orçamento
  const [modalFocoSecao, setModalFocoSecao] = useState(null); // 'anexo' | 'fluxo' | null
  const abrirModal = useCallback((lead, opcoes = {}) => {
    setLeadSelecionado(lead);
    setModalAberto(true);
    setModalFocoSecao(opcoes.focarSecao ?? null);
  }, []);

  const fecharModal = useCallback(() => {
    setLeadSelecionado(null);
    setModalAberto(false);
    setModalFocoSecao(null);
  }, []);

  // ── Ações de tarefas ──────────────────────────────────────────────────────
  async function persistTarefa(id, patchTarefa) {
    const row = tarefaToRow(patchTarefa);
    const { error } = await supabase.from('tarefas').update(row).eq('id', id);
    if (error) console.warn('[CRM] persistTarefa falhou:', error.message);
  }

  const adicionarTarefa = useCallback(async (dados) => {
    const base = {
      status: 'a_fazer',
      prioridade: 'media',
      categoria: 'geral',
      leadId: null,
      descricao: '',
      concluidaEm: null,
      dataCriacao: new Date().toISOString().split('T')[0],
      ...dados,
    };
    const { data, error } = await supabase.from('tarefas').insert(tarefaToRow(base)).select().single();
    if (error) {
      console.warn('[CRM] adicionarTarefa falhou, usando id local:', error.message);
      const tarefa = { ...base, id: `tarefa-local-${Date.now()}` };
      setTarefas((prev) => [tarefa, ...prev]);
      return tarefa;
    }
    const tarefa = rowToTarefa(data);
    setTarefas((prev) => [tarefa, ...prev]);
    return tarefa;
  }, []);

  const atualizarTarefa = useCallback((id, delta) => {
    let tarefaAtualizada = null;
    setTarefas((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      tarefaAtualizada = { ...t, ...delta };
      return tarefaAtualizada;
    }));
    if (tarefaAtualizada) persistTarefa(id, tarefaAtualizada);
  }, []);

  const removerTarefa = useCallback((id) => {
    setTarefas((prev) => prev.filter((t) => t.id !== id));
    supabase.from('tarefas').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[CRM] removerTarefa falhou:', error.message);
    });
  }, []);

  const toggleConcluirTarefa = useCallback((id) => {
    let tarefaAtualizada = null;
    setTarefas((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const jaConcluida = t.status === 'concluida';
        tarefaAtualizada = {
          ...t,
          status: jaConcluida ? 'a_fazer' : 'concluida',
          concluidaEm: jaConcluida ? null : new Date().toISOString().split('T')[0],
        };
        return tarefaAtualizada;
      })
    );
    if (tarefaAtualizada) persistTarefa(id, tarefaAtualizada);
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
          getTiposServico(l).some((t) => TIPOS_SERVICO[t]?.faturamento === 'recorrente') &&
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
        promoverParaCliente,
        leadsPorEstagio,
        abrirModal,
        fecharModal,
        modalFocoSecao,
        // Tarefas
        tarefas,
        adicionarTarefa,
        atualizarTarefa,
        removerTarefa,
        toggleConcluirTarefa,
        // Helpers
        getTiposServico,
        getTipoPrimario,
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
