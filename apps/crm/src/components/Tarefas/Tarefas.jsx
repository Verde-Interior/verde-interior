// src/components/Tarefas/Tarefas.jsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { useCRM } from '../../context/CRMContext';
import './Tarefas.css';

const PRIORIDADES = {
  alta:  { label: 'Alta',  cor: '#C23B3B' },
  media: { label: 'Média', cor: '#C47A1A' },
  baixa: { label: 'Baixa', cor: '#3D6B1E' },
};

const CATEGORIAS = {
  geral:          { label: 'Geral',           emoji: '📌' },
  visita:         { label: 'Visita',          emoji: '🗺️' },
  orcamento:      { label: 'Orçamento',       emoji: '📄' },
  followup:       { label: 'Follow-up',       emoji: '📞' },
  administrativo: { label: 'Administrativo',  emoji: '🗂️' },
};

const STATUS_GRUPOS = [
  { id: 'a_fazer',      label: 'A Fazer',       cor: '#6B7280' },
  { id: 'em_andamento', label: 'Em Andamento',  cor: '#C47A1A' },
  { id: 'concluida',    label: 'Concluída',      cor: '#1A7A4A' },
];

const EMPTY_FORM = {
  titulo: '',
  descricao: '',
  prioridade: 'media',
  status: 'a_fazer',
  categoria: 'geral',
  dataVencimento: '',
  leadId: '',
};

function formatarData(iso) {
  if (!iso) return null;
  return new Date(iso + 'T12:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
  });
}

function statusVencimento(data) {
  if (!data) return null;
  const hoje = new Date().toISOString().split('T')[0];
  if (data < hoje) return 'atrasada';
  if (data === hoje) return 'hoje';
  return null;
}

export default function Tarefas() {
  const {
    tarefas,
    adicionarTarefa,
    atualizarTarefa,
    removerTarefa,
    toggleConcluirTarefa,
    leads,
    TIPOS_SERVICO,
    abrirModal,
  } = useCRM();

  const [modalAberto, setModalAberto]   = useState(false);
  const [editando, setEditando]         = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [busca, setBusca]               = useState('');
  const [filtroPrioridade, setFiltroP]  = useState('todas');
  const [filtroCategoria, setFiltroC]   = useState('todas');
  const [gruposColapsados, setColaps]   = useState({ concluida: true });
  const [modoSelecao, setModoSelecao]   = useState(false);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    if (modalAberto && inputRef.current) inputRef.current.focus();
  }, [modalAberto]);

  // ── Tarefas derivadas do fluxo de orçamento ──────────────────────────────
  const hoje = new Date().toISOString().split('T')[0];

  const tarefasFluxo = useMemo(() => {
    const resultado = [];
    leads.forEach((lead) => {
      const f = lead.fluxoOrcamento;
      if (!f || !f.ativo) return;
      if (f.etapaAtual === 't1' && f.t1.status !== 'concluida') {
        resultado.push({ key: `${lead.id}-t1`, leadId: lead.id, empresa: lead.empresa, titulo: 'Preencher Orçamento', prazo: f.t1.prazoData, status: f.t1.status, urgente: false, etapa: 1 });
      }
      if (f.etapaAtual === 't2' && f.t2.status !== 'concluida') {
        resultado.push({ key: `${lead.id}-t2`, leadId: lead.id, empresa: lead.empresa, titulo: 'Elaborar e Enviar Orçamento', prazo: f.t2.prazoData, status: f.t2.status, urgente: f.urgente, etapa: 2 });
      }
      if (f.etapaAtual === 't3' && f.t3.status !== 'concluida') {
        resultado.push({ key: `${lead.id}-t3`, leadId: lead.id, empresa: lead.empresa, titulo: 'Confirmar Recebimento pelo Cliente', prazo: f.t3.prazoData, status: f.t3.status, urgente: false, etapa: 3 });
      }
      if (f.etapaAtual === 'ciclo_aprovacao') {
        const tentativa = f.cicloAprovacao.historico.find((h) => h.resultado === null);
        if (tentativa) {
          resultado.push({ key: `${lead.id}-ciclo`, leadId: lead.id, empresa: lead.empresa, titulo: `Ciclo de Aprovação · Tentativa ${tentativa.tentativa}`, prazo: tentativa.dataLimite, status: 'pendente', urgente: false, etapa: 4 });
        }
      }
    });
    return resultado.sort((a, b) => {
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
      return (a.prazo ?? '9999') < (b.prazo ?? '9999') ? -1 : 1;
    });
  }, [leads]);

  const metricas = useMemo(() => {
    const abertas   = tarefas.filter((t) => t.status !== 'concluida');
    const paraHoje  = abertas.filter((t) => t.dataVencimento === hoje);
    const atrasadas = abertas.filter((t) => t.dataVencimento && t.dataVencimento < hoje);
    const concluidas = tarefas.filter((t) => t.status === 'concluida');
    return { abertas: abertas.length, paraHoje: paraHoje.length, atrasadas: atrasadas.length, concluidas: concluidas.length };
  }, [tarefas, hoje]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const tarefasFiltradas = useMemo(() => {
    const q = busca.toLowerCase();
    return tarefas.filter((t) => {
      if (filtroPrioridade !== 'todas' && t.prioridade !== filtroPrioridade) return false;
      if (filtroCategoria !== 'todas' && t.categoria !== filtroCategoria) return false;
      if (q && !t.titulo.toLowerCase().includes(q) && !(t.descricao?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tarefas, busca, filtroPrioridade, filtroCategoria]);

  // ── Ações do modal ────────────────────────────────────────────────────────
  function abrirNova(statusInicial = 'a_fazer') {
    setEditando(null);
    setForm({ ...EMPTY_FORM, status: statusInicial });
    setModalAberto(true);
  }

  function abrirEditar(tarefa) {
    setEditando(tarefa);
    setForm({
      titulo:         tarefa.titulo,
      descricao:      tarefa.descricao ?? '',
      prioridade:     tarefa.prioridade,
      status:         tarefa.status,
      categoria:      tarefa.categoria,
      dataVencimento: tarefa.dataVencimento ?? '',
      leadId:         tarefa.leadId ?? '',
    });
    setModalAberto(true);
  }

  function salvar() {
    if (!form.titulo.trim()) return;
    const dados = { ...form, leadId: form.leadId || null };
    if (editando) {
      atualizarTarefa(editando.id, dados);
    } else {
      adicionarTarefa(dados);
    }
    setModalAberto(false);
    setEditando(null);
  }

  function excluir(id) {
    removerTarefa(id);
    setModalAberto(false);
    setEditando(null);
  }

  function toggleGrupo(id) {
    setColaps((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSelecao(id) {
    setSelecionadas((prev) => {
      const nova = new Set(prev);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  }

  function concluirSelecionadas() {
    selecionadas.forEach((id) => {
      const t = tarefas.find((t) => t.id === id);
      if (t && t.status !== 'concluida') toggleConcluirTarefa(id);
    });
    setSelecionadas(new Set());
    setModoSelecao(false);
  }

  function cancelarSelecao() {
    setSelecionadas(new Set());
    setModoSelecao(false);
  }

  const leadLabel = (id) => {
    const l = leads.find((l) => l.id === id);
    return l ? l.empresa : null;
  };

  return (
    <div className="tarefas">

      {/* ── Cabeçalho ── */}
      <header className="tarefas__header">
        <div className="tarefas__header-topo">
          <div>
            <h2 className="tarefas__titulo">Tarefas</h2>
            <p className="tarefas__subtitulo">Controle de atividades e compromissos</p>
          </div>
          <div className="tarefas__header-acoes">
            <button
              className={`tarefas__btn-selecionar ${modoSelecao ? 'tarefas__btn-selecionar--ativo' : ''}`}
              onClick={() => modoSelecao ? cancelarSelecao() : setModoSelecao(true)}
            >
              {modoSelecao ? '✕ Cancelar' : '☑ Selecionar'}
            </button>
            <button className="tarefas__btn-nova" onClick={() => abrirNova()}>
              + Nova Tarefa
            </button>
          </div>
        </div>

        {/* ── Cards de resumo ── */}
        <div className="tarefas__kpis">
          <div className={`tarefas__kpi ${metricas.atrasadas > 0 ? 'tarefas__kpi--perigo' : ''}`}>
            <span className="tarefas__kpi-valor">{metricas.atrasadas}</span>
            <span className="tarefas__kpi-label">Atrasadas</span>
            <span className="tarefas__kpi-sub">requerem atenção imediata</span>
          </div>

          <div className={`tarefas__kpi ${metricas.paraHoje > 0 ? 'tarefas__kpi--alerta' : ''}`}>
            <span className="tarefas__kpi-valor">{metricas.paraHoje}</span>
            <span className="tarefas__kpi-label">Para Hoje</span>
            <span className="tarefas__kpi-sub">vencem hoje</span>
          </div>

          <div className="tarefas__kpi tarefas__kpi--destaque">
            <span className="tarefas__kpi-valor">{metricas.abertas}</span>
            <span className="tarefas__kpi-label">Em Aberto</span>
            <span className="tarefas__kpi-sub">a fazer e em andamento</span>
          </div>

          <div className="tarefas__kpi">
            <span className="tarefas__kpi-valor">{metricas.concluidas}</span>
            <span className="tarefas__kpi-label">Concluídas</span>
            <span className="tarefas__kpi-sub">tarefas finalizadas</span>
          </div>
        </div>
      </header>

      {/* ── Filtros ── */}
      <div className="tarefas__filtros">
        <div className="tarefas__busca-wrap">
          <span className="tarefas__busca-icon">⌕</span>
          <input
            className="tarefas__busca"
            placeholder="Buscar tarefa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <select
          className="tarefas__select"
          value={filtroPrioridade}
          onChange={(e) => setFiltroP(e.target.value)}
        >
          <option value="todas">Prioridade</option>
          {Object.entries(PRIORIDADES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          className="tarefas__select"
          value={filtroCategoria}
          onChange={(e) => setFiltroC(e.target.value)}
        >
          <option value="todas">Categoria</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
      </div>

      {/* ── Lista por status + Checklist ── */}
      <div className="tarefas__corpo">
        {STATUS_GRUPOS.map((grupo) => {
          const itens = tarefasFiltradas.filter((t) => t.status === grupo.id);
          const colapsado = gruposColapsados[grupo.id];

          return (
            <section key={grupo.id} className="tarefas__grupo">
              <button
                className="tarefas__grupo-header"
                onClick={() => toggleGrupo(grupo.id)}
              >
                <span className="tarefas__grupo-dot" style={{ background: grupo.cor }} />
                <span className="tarefas__grupo-label">{grupo.label}</span>
                <span className="tarefas__grupo-count">{itens.length}</span>
                <span className="tarefas__grupo-chevron">{colapsado ? '▶' : '▼'}</span>
              </button>

              {!colapsado && (
                <div className="tarefas__grupo-corpo">
                  {itens.length === 0 ? (
                    <p className="tarefas__vazio">Nenhuma tarefa aqui.</p>
                  ) : (
                    itens.map((t) => {
                      const sv = statusVencimento(t.dataVencimento);
                      const concluida = t.status === 'concluida';
                      const cat = CATEGORIAS[t.categoria];
                      const pri = PRIORIDADES[t.prioridade];

                      return (
                        <div
                          key={t.id}
                          className={`tarefa-item ${concluida ? 'tarefa-item--concluida' : ''} ${modoSelecao && selecionadas.has(t.id) ? 'tarefa-item--selecionada' : ''}`}
                        >
                          {/* Checkbox de seleção bulk */}
                          {modoSelecao ? (
                            <button
                              className={`tarefa-item__check-sel ${selecionadas.has(t.id) ? 'tarefa-item__check-sel--marcado' : ''}`}
                              onClick={() => toggleSelecao(t.id)}
                            >
                              {selecionadas.has(t.id) && '✓'}
                            </button>
                          ) : (
                          <button
                            className={`tarefa-item__check ${concluida ? 'tarefa-item__check--marcado' : ''}`}
                            onClick={() => toggleConcluirTarefa(t.id)}
                            title={concluida ? 'Reabrir' : 'Concluir'}
                          >
                            {concluida && '✓'}
                          </button>
                          )}

                          {/* Prioridade */}
                          <span
                            className="tarefa-item__prio"
                            style={{ background: pri.cor }}
                            title={`Prioridade ${pri.label}`}
                          />

                          {/* Conteúdo principal */}
                          <div
                            className="tarefa-item__corpo"
                            onClick={() => abrirEditar(t)}
                          >
                            <span className="tarefa-item__titulo">{t.titulo}</span>
                            <div className="tarefa-item__meta">
                              {cat && (
                                <span className="tarefa-item__cat">
                                  {cat.emoji} {cat.label}
                                </span>
                              )}
                              {t.leadId && leadLabel(t.leadId) && (
                                <span className="tarefa-item__lead">
                                  {leadLabel(t.leadId)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Data de vencimento */}
                          {t.dataVencimento && (
                            <span
                              className={`tarefa-item__data ${sv === 'atrasada' ? 'tarefa-item__data--atrasada' : sv === 'hoje' ? 'tarefa-item__data--hoje' : ''}`}
                            >
                              {sv === 'atrasada' && '⚠ '}
                              {sv === 'hoje' ? 'Hoje' : formatarData(t.dataVencimento)}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Adicionar inline */}
                  {grupo.id !== 'concluida' && (
                    <button
                      className="tarefas__add-inline"
                      onClick={() => abrirNova(grupo.id)}
                    >
                      + Adicionar tarefa
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* ── Checklist de Orçamentos ── */}
        {tarefasFluxo.length > 0 && (
        <section className="tarefas__grupo tarefas__grupo--fluxo">
          <div className="tarefas__grupo-header" style={{ cursor: 'default' }}>
            <span className="tarefas__grupo-dot" style={{ background: '#8B5CF6' }} />
            <span className="tarefas__grupo-label">Checklist de Orçamentos</span>
            <span className="tarefas__grupo-count">{tarefasFluxo.length}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>Gerado automaticamente · ação via modal do lead</span>
          </div>
          <div className="tarefas__grupo-corpo">
            {tarefasFluxo.map((t) => {
              const sv = !t.prazo ? null : t.prazo < hoje ? 'atrasada' : t.prazo === hoje ? 'hoje' : null;
              const lead = leads.find((l) => l.id === t.leadId);
              return (
                <div key={t.key} className={`tarefa-item tarefa-item--fluxo ${t.urgente ? 'tarefa-item--urgente' : ''}`}>
                  <span className="tarefa-item__fluxo-etapa">{t.etapa}</span>
                  <span className="tarefa-item__prio" style={{ background: t.urgente ? '#C23B3B' : '#8B5CF6' }} title={t.urgente ? 'URGENTE' : 'Orçamento'} />
                  <div className="tarefa-item__corpo">
                    <span className="tarefa-item__titulo">
                      {t.urgente && <span className="tarefa-item__urgente-tag">⚠ URGENTE · </span>}
                      {t.titulo}
                    </span>
                    <div className="tarefa-item__meta">
                      <span className="tarefa-item__cat">📋 Orçamento</span>
                      <span className="tarefa-item__lead">{t.empresa}</span>
                    </div>
                  </div>
                  {t.prazo && (
                    <span className={`tarefa-item__data ${sv === 'atrasada' ? 'tarefa-item__data--atrasada' : sv === 'hoje' ? 'tarefa-item__data--hoje' : ''}`}>
                      {sv === 'atrasada' && '⚠ '}
                      {sv === 'hoje' ? 'Hoje' : formatarData(t.prazo)}
                    </span>
                  )}
                  <button
                    className="tarefa-item__abrir-lead"
                    onClick={(e) => { e.stopPropagation(); if (lead) abrirModal(lead); }}
                    title="Abrir modal do lead"
                  >
                    Abrir Lead →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        )}
      </div>

      {/* ── Barra de bulk actions ── */}
      {modoSelecao && (
        <div className="tarefas__bulk-bar">
          <span className="tarefas__bulk-info">
            {selecionadas.size} tarefa{selecionadas.size !== 1 ? 's' : ''} selecionada{selecionadas.size !== 1 ? 's' : ''}
          </span>
          <div className="tarefas__bulk-acoes">
            <button
              className="tarefas__bulk-btn tarefas__bulk-btn--concluir"
              disabled={selecionadas.size === 0}
              onClick={concluirSelecionadas}
            >
              ✓ Concluir selecionadas
            </button>
            <button className="tarefas__bulk-btn tarefas__bulk-btn--cancelar" onClick={cancelarSelecao}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de criação/edição ── */}
      {modalAberto && (
        <div className="tarefa-modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalAberto(false)}>
          <div className="tarefa-modal">
            <header className="tarefa-modal__header">
              <h3 className="tarefa-modal__titulo">
                {editando ? 'Editar Tarefa' : 'Nova Tarefa'}
              </h3>
              <button className="tarefa-modal__fechar" onClick={() => setModalAberto(false)}>✕</button>
            </header>

            <div className="tarefa-modal__corpo">
              {/* Título */}
              <div className="tarefa-modal__campo tarefa-modal__campo--wide">
                <label className="tarefa-modal__label">Título <span className="tarefa-modal__req">*</span></label>
                <input
                  ref={inputRef}
                  className="tarefa-modal__input"
                  placeholder="Descreva a tarefa..."
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && salvar()}
                />
              </div>

              {/* Prioridade + Status */}
              <div className="tarefa-modal__campo">
                <label className="tarefa-modal__label">Prioridade</label>
                <div className="tarefa-modal__pills">
                  {Object.entries(PRIORIDADES).map(([k, v]) => (
                    <label
                      key={k}
                      className={`tarefa-modal__pill ${form.prioridade === k ? 'tarefa-modal__pill--ativo' : ''}`}
                      style={{ '--pill-cor': v.cor }}
                    >
                      <input type="radio" name="prioridade" value={k} checked={form.prioridade === k} onChange={() => setForm((f) => ({ ...f, prioridade: k }))} />
                      {v.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="tarefa-modal__campo">
                <label className="tarefa-modal__label">Status</label>
                <select
                  className="tarefa-modal__select"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_GRUPOS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Categoria + Lead */}
              <div className="tarefa-modal__campo">
                <label className="tarefa-modal__label">Categoria</label>
                <select
                  className="tarefa-modal__select"
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                >
                  {Object.entries(CATEGORIAS).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>

              <div className="tarefa-modal__campo">
                <label className="tarefa-modal__label">Lead relacionado</label>
                <select
                  className="tarefa-modal__select"
                  value={form.leadId}
                  onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))}
                >
                  <option value="">Nenhum</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.empresa}</option>
                  ))}
                </select>
              </div>

              {/* Data de vencimento */}
              <div className="tarefa-modal__campo">
                <label className="tarefa-modal__label">Data de Vencimento</label>
                <input
                  type="date"
                  className="tarefa-modal__input"
                  value={form.dataVencimento}
                  min={editando ? undefined : hoje}
                  onChange={(e) => setForm((f) => ({ ...f, dataVencimento: e.target.value }))}
                />
              </div>

              {/* Descrição */}
              <div className="tarefa-modal__campo tarefa-modal__campo--wide">
                <label className="tarefa-modal__label">Descrição</label>
                <textarea
                  className="tarefa-modal__textarea"
                  rows={3}
                  placeholder="Detalhes adicionais..."
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
            </div>

            <footer className="tarefa-modal__footer">
              {editando && (
                <button
                  className="tarefa-modal__btn tarefa-modal__btn--excluir"
                  onClick={() => excluir(editando.id)}
                >
                  Excluir
                </button>
              )}
              <div className="tarefa-modal__footer-dir">
                <button className="tarefa-modal__btn tarefa-modal__btn--cancelar" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button
                  className="tarefa-modal__btn tarefa-modal__btn--salvar"
                  onClick={salvar}
                  disabled={!form.titulo.trim()}
                >
                  {editando ? 'Salvar' : 'Criar Tarefa'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
