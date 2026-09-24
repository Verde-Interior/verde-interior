// src/components/CeasaHolambra/CeasaHolambra.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast/Toast';
import CeasaCard from './CeasaCard';
import TelefonesInput from './TelefonesInput';
import ArquivosProposta from './ArquivosProposta';
import '../KanbanBoard/KanbanBoard.css';
import '../KanbanColumn/KanbanColumn.css';
import '../LeadCard/LeadCard.css';
import './CeasaHolambra.css';

const ETAPAS = [
  { id: 'prospecto',        label: 'Prospecto',             cor: '#6B7280' },
  { id: 'contato_feito',    label: 'Contato Feito',         cor: '#F59E0B' },
  { id: 'interesse',        label: 'Interesse Demonstrado', cor: '#3B82F6' },
  { id: 'proposta_enviada', label: 'Proposta Enviada',      cor: '#8B5CF6' },
  { id: 'fechado',          label: 'Fechado',               cor: '#10B981' },
  { id: 'sem_interesse',    label: 'Sem Interesse',         cor: '#EF4444' },
];

const PREFERENCIAS_CONTATO = [
  { id: '',           label: 'Não sabemos' },
  { id: 'telefone',   label: 'Telefone' },
  { id: 'whatsapp',   label: 'WhatsApp' },
  { id: 'email',      label: 'E-mail' },
  { id: 'presencial', label: 'Presencial' },
];

const ORIGENS_SUGERIDAS = ['Squad Veiling', 'Indicação', 'Prospecção manual', 'Outros'];

const VAZIO = {
  nome_loja: '', responsavel: '', telefones: [], email: '',
  preferencia_contato: '', tipo: '', produtos_interesse: '', observacoes: '', endereco: '',
  etapa: 'prospecto', valor_venda: '', motivo_perda: '',
  proximo_followup_em: '', proximo_followup_nota: '', origem: '',
};

function digitosOnly(str) { return (str ?? '').replace(/\D/g, ''); }

export default function CeasaHolambra() {
  const toast = useToast();
  const [prospects, setProspects] = useState([]);
  const [tipos, setTipos]         = useState([]);
  const [busca, setBusca]         = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modoVista, setModoVista] = useState('kanban');
  const [modal, setModal]         = useState(null);
  const [salvando, setSalvando]   = useState(false);
  const [dragId, setDragId]       = useState(null);
  const [dragOver, setDragOver]   = useState(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState(null);
  const [motivoPrompt, setMotivoPrompt] = useState(null); // { ceasaId, nomeLoja, motivo }
  const [novoTipoAberto, setNovoTipoAberto] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');

  const carregar = useCallback(async () => {
    const [{ data, error }, { data: tiposData }] = await Promise.all([
      supabase.from('ceasa_prospects').select('*').order('created_at', { ascending: false }),
      supabase.from('ceasa_tipos_loja').select('*').order('nome'),
    ]);
    if (error) { toast.erro('Erro ao carregar'); return; }
    setProspects(data ?? []);
    setTipos(tiposData ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Garante que o estado de drag seja limpo se o mouse soltar fora de uma coluna
  useEffect(() => {
    function cleanup() { setDragId(null); setDragOver(null); }
    document.addEventListener('dragend', cleanup);
    return () => document.removeEventListener('dragend', cleanup);
  }, []);

  const filtrados = prospects.filter(p => {
    const q = busca.toLowerCase();
    const numeros = (p.telefones ?? []).map(t => t.numero?.toLowerCase() ?? '').join(' ');
    const okBusca = !q
      || p.nome_loja?.toLowerCase().includes(q)
      || p.responsavel?.toLowerCase().includes(q)
      || p.endereco?.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q)
      || numeros.includes(q);
    const okTipo  = filtroTipo === 'todos' || p.tipo === filtroTipo;
    return okBusca && okTipo;
  });

  const temFiltro = busca || filtroTipo !== 'todos';

  function labelTipo(tipo) {
    return tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : '—';
  }

  // ── Modal ──
  function abrirAdd()   { setModal({ modo: 'add',  dados: { ...VAZIO, tipo: tipos[0]?.nome ?? '' } }); setAvisoDuplicado(null); }
  function abrirEdit(p) { setModal({ modo: 'edit', dados: { ...VAZIO, ...p }, etapaOriginal: p.etapa }); setAvisoDuplicado(null); }
  function fechar()     { setModal(null); setAvisoDuplicado(null); setNovoTipoAberto(false); setNovoTipoNome(''); }
  function setField(k, v) { setModal(m => ({ ...m, dados: { ...m.dados, [k]: v } })); }

  async function confirmarNovoTipo() {
    const nome = novoTipoNome.trim().toLowerCase();
    if (!nome) return;
    const { data, error } = await supabase.from('ceasa_tipos_loja').insert({ nome }).select().single();
    if (error) {
      // já existe (conflito de unique) — só seleciona o existente
      const existente = tipos.find(t => t.nome === nome);
      if (existente) setField('tipo', existente.nome);
      else toast.erro('Erro ao criar tipo: ' + error.message);
    } else {
      setTipos(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setField('tipo', data.nome);
    }
    setNovoTipoAberto(false);
    setNovoTipoNome('');
  }

  async function buscarDuplicado(d, ignorarId) {
    const nomeNormalizado = d.nome_loja.trim().toLowerCase();
    const numerosNovos = (d.telefones ?? []).map(t => digitosOnly(t.numero)).filter(Boolean);
    const candidato = prospects.find(p => {
      if (p.id === ignorarId) return false;
      if (p.nome_loja?.trim().toLowerCase() === nomeNormalizado) return true;
      const pNums = (p.telefones ?? []).map(t => digitosOnly(t.numero)).filter(Boolean);
      return numerosNovos.some(n => pNums.includes(n));
    });
    return candidato ?? null;
  }

  async function salvar({ ignorarDuplicado } = {}) {
    const d = modal.dados;
    if (!d.nome_loja.trim()) { toast.erro('Informe o nome da loja'); return; }
    if (d.etapa === 'sem_interesse' && !d.motivo_perda?.trim()) {
      toast.erro('Informe o motivo antes de marcar como "Sem Interesse"');
      return;
    }

    if (!ignorarDuplicado) {
      const dup = await buscarDuplicado(d, modal.modo === 'edit' ? d.id : undefined);
      if (dup) { setAvisoDuplicado(dup); return; }
    }
    setAvisoDuplicado(null);

    setSalvando(true);
    try {
      const payload = {
        nome_loja: d.nome_loja.trim(), responsavel: d.responsavel || null,
        telefones: (d.telefones ?? []).filter(t => t.numero?.trim()),
        email: d.email || null,
        preferencia_contato: d.preferencia_contato || null,
        tipo: d.tipo || null, produtos_interesse: d.produtos_interesse || null,
        observacoes: d.observacoes || null, endereco: d.endereco || null,
        etapa: d.etapa,
        valor_venda: d.valor_venda === '' || d.valor_venda == null ? null : Number(d.valor_venda),
        motivo_perda: d.etapa === 'sem_interesse' ? (d.motivo_perda || null) : null,
        proximo_followup_em: d.proximo_followup_em || null,
        proximo_followup_nota: d.proximo_followup_nota || null,
        origem: d.origem || null,
      };
      // Grava fechado_em só na transição para "fechado" — não sobrescreve
      // se o prospect já estava fechado antes desta edição.
      const fechandoAgora = d.etapa === 'fechado' && (modal.modo === 'add' || modal.etapaOriginal !== 'fechado');
      if (fechandoAgora) payload.fechado_em = new Date().toISOString().split('T')[0];

      const etapaMudou = modal.modo === 'add' || modal.etapaOriginal !== d.etapa;
      if (etapaMudou) payload.etapa_atualizada_em = new Date().toISOString();

      if (modal.modo === 'add') {
        const { error } = await supabase.from('ceasa_prospects').insert(payload);
        if (error) throw error;
        toast.ok(`${d.nome_loja} adicionada`);
      } else {
        const { error } = await supabase.from('ceasa_prospects').update(payload).eq('id', d.id);
        if (error) throw error;
        toast.ok(`${d.nome_loja} atualizada`);
      }
      fechar();
      carregar();
    } catch (e) {
      toast.erro('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  // ── Drag & Drop entre colunas ──
  async function aplicarMudancaEtapa(ceasaId, novaEtapa, motivoPerda) {
    const atual = prospects.find(p => p.id === ceasaId);
    const patch = { etapa: novaEtapa, etapa_atualizada_em: new Date().toISOString() };
    // Grava fechado_em só na transição para "fechado" — não sobrescreve
    // se o prospect já estava fechado antes deste movimento.
    if (novaEtapa === 'fechado' && atual?.etapa !== 'fechado') {
      patch.fechado_em = new Date().toISOString().split('T')[0];
    }
    if (novaEtapa === 'sem_interesse') patch.motivo_perda = motivoPerda || null;
    setProspects(prev => prev.map(p => p.id === ceasaId ? { ...p, ...patch } : p));
    const { error } = await supabase.from('ceasa_prospects').update(patch).eq('id', ceasaId);
    if (error) { toast.erro('Erro ao mover'); carregar(); }
  }

  function moverParaEtapa(ceasaId, novaEtapa) {
    if (novaEtapa === 'sem_interesse') {
      const atual = prospects.find(p => p.id === ceasaId);
      if (atual?.etapa === 'sem_interesse') return;
      setMotivoPrompt({ ceasaId, nomeLoja: atual?.nome_loja ?? '', motivo: '' });
      return;
    }
    aplicarMudancaEtapa(ceasaId, novaEtapa);
  }

  function handleColDragOver(e, etapaId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== etapaId) setDragOver(etapaId);
  }

  function handleColDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  }

  function handleColDrop(e, etapaId) {
    e.preventDefault();
    setDragOver(null);
    setDragId(null);
    const id = e.dataTransfer.getData('ceasaId');
    if (id) moverParaEtapa(id, etapaId);
  }

  // ── Vista lista ──
  const ETAPA_MAP = Object.fromEntries(ETAPAS.map(e => [e.id, e]));

  return (
    <div className="kanban-board">
      {/* ── Topbar ── */}
      <header className="kanban-board__topbar">
        <div className="kanban-board__topbar-esq">
          <h1 className="kanban-board__titulo">Pipeline Ceasa / Holambra</h1>
          <div className="kanban-board__metricas">
            <span className="kanban-board__metrica"><strong>{prospects.length}</strong> prospects</span>
            <span className="kanban-board__sep">·</span>
            <span className="kanban-board__metrica">
              <strong>{prospects.filter(p => p.etapa === 'fechado').length}</strong> fechados
            </span>
            <span className="kanban-board__sep">·</span>
            <span className="kanban-board__metrica kanban-board__metrica--destaque">
              <strong>
                {prospects.length > 0
                  ? Math.round((prospects.filter(p => p.etapa === 'fechado').length / prospects.length) * 100)
                  : 0}%
              </strong> conversão
            </span>
          </div>
        </div>
        <div className="kanban-board__topbar-acoes">
          <div className="kanban-board__vista-toggle">
            <button
              className={`kanban-board__vista-btn ${modoVista === 'kanban' ? 'kanban-board__vista-btn--ativo' : ''}`}
              onClick={() => setModoVista('kanban')}
            >⠿ Kanban</button>
            <button
              className={`kanban-board__vista-btn ${modoVista === 'lista' ? 'kanban-board__vista-btn--ativo' : ''}`}
              onClick={() => setModoVista('lista')}
            >☰ Lista</button>
          </div>
          <button className="kanban-board__btn-add" onClick={abrirAdd}>+ Nova Loja</button>
        </div>
      </header>

      {/* ── Filtros ── */}
      <div className="kanban-board__filtros">
        <div className="kanban-board__busca-wrapper">
          <span className="kanban-board__busca-icon">⌕</span>
          <input
            className="kanban-board__busca"
            placeholder="Buscar loja, responsável, e-mail, telefone ou endereço..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button className="kanban-board__busca-limpar" onClick={() => setBusca('')}>✕</button>
          )}
        </div>
        <select className="kanban-board__select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {tipos.map(t => <option key={t.id} value={t.nome}>{labelTipo(t.nome)}</option>)}
        </select>
        {temFiltro && (
          <button className="kanban-board__limpar-filtros" onClick={() => { setBusca(''); setFiltroTipo('todos'); }}>
            Limpar filtros
          </button>
        )}
        {temFiltro && (
          <span className="kanban-board__resultado">
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Kanban ── */}
      {modoVista === 'kanban' ? (
        <div className="kanban-board__colunas">
          {ETAPAS.map(etapa => {
            const cards      = filtrados.filter(p => p.etapa === etapa.id);
            const isDropOver = dragOver === etapa.id && dragId;
            return (
              <section
                key={etapa.id}
                className={`kanban-column ${isDropOver ? 'kanban-column--drag-over' : ''}`}
                onDragOver={e => handleColDragOver(e, etapa.id)}
                onDragLeave={handleColDragLeave}
                onDrop={e => handleColDrop(e, etapa.id)}
              >
                <header className="kanban-column__header">
                  <div className="kanban-column__titulo-row">
                    <span className="kanban-column__indicador" style={{ '--col-cor': etapa.cor }} />
                    <h2 className="kanban-column__titulo">{etapa.label}</h2>
                    <span className="kanban-column__contador">{cards.length}</span>
                  </div>
                </header>
                <div className="kanban-column__cards">
                  {isDropOver && cards.length === 0 && (
                    <div className="kanban-column__drop-placeholder">Solte aqui</div>
                  )}
                  {cards.length === 0 && !isDropOver
                    ? <p className="kanban-column__vazio">Nenhuma loja aqui.</p>
                    : cards.map(p => (
                        <CeasaCard
                          key={p.id}
                          prospect={p}
                          dragId={dragId}
                          setDragId={setDragId}
                          onEditar={abrirEdit}
                          onAtualizar={carregar}
                        />
                      ))
                  }
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* ── Lista ── */
        <div className="kanban-board__lista-wrap">
          <table className="kanban-board__lista-tabela">
            <thead>
              <tr>
                <th>Loja</th>
                <th>Responsável</th>
                <th>Tipo</th>
                <th>E-mail</th>
                <th>Origem</th>
                <th>Endereço</th>
                <th>Etapa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={8} className="kanban-board__lista-vazio">Nenhuma loja encontrada</td></tr>
              ) : (
                filtrados.map(p => {
                  const etapa = ETAPA_MAP[p.etapa];
                  const telPrimeiro = (p.telefones ?? []).find(t => t.whatsapp)?.numero ?? (p.telefones ?? [])[0]?.numero;
                  return (
                    <tr key={p.id} className="kanban-board__lista-linha" onClick={() => abrirEdit(p)}>
                      <td className="kanban-board__lista-empresa">
                        <span className="kanban-board__lista-nome">{p.nome_loja}</span>
                      </td>
                      <td className="kanban-board__lista-contato">{p.responsavel ?? '—'}</td>
                      <td>
                        <span className="kanban-board__lista-badge" style={{ '--badge-cor': '#8B5CF6' }}>
                          {labelTipo(p.tipo)}
                        </span>
                      </td>
                      <td className="kanban-board__lista-contato">{p.email ?? '—'}</td>
                      <td className="kanban-board__lista-contato">{p.origem ?? '—'}</td>
                      <td className="kanban-board__lista-bairro">{p.endereco ? `📍 ${p.endereco}` : '—'}</td>
                      <td>
                        <span className="kanban-board__lista-estagio" style={{ '--est-cor': etapa?.cor ?? '#6B7280' }}>
                          {etapa?.label ?? p.etapa}
                        </span>
                      </td>
                      <td>
                        {telPrimeiro && (
                          <a
                            href={`https://wa.me/55${digitosOnly(telPrimeiro)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="kanban-board__lista-wa"
                            onClick={e => e.stopPropagation()}
                          >💬</a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal add/edit ── */}
      {modal && (
        <div className="ceasa__overlay" onClick={e => e.target === e.currentTarget && fechar()}>
          <div className="ceasa__modal">
            <div className="ceasa__modal-header">
              <span className="ceasa__modal-titulo">{modal.modo === 'add' ? 'Nova Loja' : 'Editar Loja'}</span>
              <button className="ceasa__modal-fechar" onClick={fechar}>✕</button>
            </div>
            <div className="ceasa__modal-corpo">
              <div className="ceasa__campo">
                <label>Nome da Loja *</label>
                <input value={modal.dados.nome_loja} onChange={e => setField('nome_loja', e.target.value)} placeholder="Ex: Floricultura das Rosas" />
              </div>

              {avisoDuplicado && (
                <div className="ceasa__aviso-duplicado">
                  <span>⚠ Já existe uma loja parecida: <strong>{avisoDuplicado.nome_loja}</strong></span>
                  <div className="ceasa__aviso-duplicado-acoes">
                    <button type="button" onClick={() => { fechar(); abrirEdit(avisoDuplicado); }}>Ver loja existente</button>
                    <button type="button" onClick={() => salvar({ ignorarDuplicado: true })}>Cadastrar mesmo assim</button>
                  </div>
                </div>
              )}

              <div className="ceasa__grid-2">
                <div className="ceasa__campo">
                  <label>Tipo</label>
                  {!novoTipoAberto ? (
                    <select
                      value={modal.dados.tipo}
                      onChange={e => {
                        if (e.target.value === '__novo__') { setNovoTipoAberto(true); return; }
                        setField('tipo', e.target.value);
                      }}
                    >
                      {!modal.dados.tipo && <option value="">Selecione...</option>}
                      {tipos.map(t => <option key={t.id} value={t.nome}>{labelTipo(t.nome)}</option>)}
                      <option value="__novo__">+ Adicionar tipo...</option>
                    </select>
                  ) : (
                    <div className="ceasa__novo-tipo">
                      <input
                        autoFocus
                        value={novoTipoNome}
                        onChange={e => setNovoTipoNome(e.target.value)}
                        placeholder="Nome do novo tipo"
                        onKeyDown={e => e.key === 'Enter' && confirmarNovoTipo()}
                      />
                      <button type="button" onClick={confirmarNovoTipo}>Adicionar</button>
                      <button type="button" onClick={() => { setNovoTipoAberto(false); setNovoTipoNome(''); }}>Cancelar</button>
                    </div>
                  )}
                </div>
                <div className="ceasa__campo">
                  <label>Etapa do Funil</label>
                  <select value={modal.dados.etapa} onChange={e => setField('etapa', e.target.value)}>
                    {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              </div>

              {modal.dados.etapa === 'sem_interesse' && (
                <div className="ceasa__campo">
                  <label>Motivo (obrigatório)</label>
                  <input
                    value={modal.dados.motivo_perda ?? ''}
                    onChange={e => setField('motivo_perda', e.target.value)}
                    placeholder="Ex: sem orçamento, já tem fornecedor fixo..."
                  />
                </div>
              )}

              <div className="ceasa__campo">
                <label>Valor da Venda (R$)</label>
                <input
                  type="number"
                  min={0}
                  value={modal.dados.valor_venda ?? ''}
                  onChange={e => setField('valor_venda', e.target.value)}
                  placeholder="Preencha ao fechar a venda"
                />
              </div>

              <div className="ceasa__campo">
                <label>Responsável</label>
                <input value={modal.dados.responsavel ?? ''} onChange={e => setField('responsavel', e.target.value)} placeholder="Nome do contato" />
              </div>

              <div className="ceasa__campo">
                <label>Telefones</label>
                <TelefonesInput value={modal.dados.telefones ?? []} onChange={v => setField('telefones', v)} />
              </div>

              <div className="ceasa__grid-2">
                <div className="ceasa__campo">
                  <label>E-mail</label>
                  <input type="email" value={modal.dados.email ?? ''} onChange={e => setField('email', e.target.value)} placeholder="contato@loja.com.br" />
                </div>
                <div className="ceasa__campo">
                  <label>Preferência de Contato</label>
                  <select value={modal.dados.preferencia_contato ?? ''} onChange={e => setField('preferencia_contato', e.target.value)}>
                    {PREFERENCIAS_CONTATO.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="ceasa__campo">
                <label>Endereço</label>
                <input value={modal.dados.endereco ?? ''} onChange={e => setField('endereco', e.target.value)} placeholder="Rua, número, cidade" />
              </div>

              <div className="ceasa__campo">
                <label>Produtos de Interesse</label>
                <input value={modal.dados.produtos_interesse ?? ''} onChange={e => setField('produtos_interesse', e.target.value)} placeholder="Ex: Plantas, Vasos, Flores" />
              </div>

              <div className="ceasa__grid-2">
                <div className="ceasa__campo">
                  <label>Próximo Follow-up</label>
                  <input type="date" value={modal.dados.proximo_followup_em ?? ''} onChange={e => setField('proximo_followup_em', e.target.value)} />
                </div>
                <div className="ceasa__campo">
                  <label>Origem do Lead</label>
                  <input
                    list="ceasa-origens"
                    value={modal.dados.origem ?? ''}
                    onChange={e => setField('origem', e.target.value)}
                    placeholder="Ex: Squad Veiling"
                  />
                  <datalist id="ceasa-origens">
                    {ORIGENS_SUGERIDAS.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>
              </div>

              {modal.dados.proximo_followup_em && (
                <div className="ceasa__campo">
                  <label>Nota do Follow-up</label>
                  <input
                    value={modal.dados.proximo_followup_nota ?? ''}
                    onChange={e => setField('proximo_followup_nota', e.target.value)}
                    placeholder="O que lembrar de falar/fazer"
                  />
                </div>
              )}

              <div className="ceasa__campo">
                <label>Observações</label>
                <textarea value={modal.dados.observacoes ?? ''} onChange={e => setField('observacoes', e.target.value)} placeholder="Anotações sobre a loja..." />
              </div>

              {modal.modo === 'edit' && (
                <ArquivosProposta prospectId={modal.dados.id} destaque={modal.dados.etapa === 'proposta_enviada'} />
              )}
            </div>
            <div className="ceasa__modal-footer">
              {modal.modo === 'edit'
                ? <button className="ceasa__btn-excluir" onClick={async () => {
                    if (!confirm(`Excluir "${modal.dados.nome_loja}"?`)) return;
                    const { error } = await supabase.from('ceasa_prospects').delete().eq('id', modal.dados.id);
                    if (error) toast.erro('Erro ao excluir');
                    else { toast.ok('Prospect excluído'); fechar(); carregar(); }
                  }}>Excluir</button>
                : <div />
              }
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ceasa__btn-cancelar" onClick={fechar}>Cancelar</button>
                <button className="ceasa__btn-salvar" onClick={() => salvar()} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Prompt de motivo ao mover para "Sem Interesse" via drag & drop ── */}
      {motivoPrompt && (
        <div className="ceasa__overlay" onClick={e => e.target === e.currentTarget && setMotivoPrompt(null)}>
          <div className="ceasa__modal ceasa__modal--pequeno">
            <div className="ceasa__modal-header">
              <span className="ceasa__modal-titulo">Por que "{motivoPrompt.nomeLoja}" perdeu o interesse?</span>
            </div>
            <div className="ceasa__modal-corpo">
              <div className="ceasa__campo">
                <input
                  autoFocus
                  value={motivoPrompt.motivo}
                  onChange={e => setMotivoPrompt(m => ({ ...m, motivo: e.target.value }))}
                  placeholder="Ex: sem orçamento, já tem fornecedor fixo..."
                  onKeyDown={e => e.key === 'Enter' && motivoPrompt.motivo.trim() && (aplicarMudancaEtapa(motivoPrompt.ceasaId, 'sem_interesse', motivoPrompt.motivo), setMotivoPrompt(null))}
                />
              </div>
            </div>
            <div className="ceasa__modal-footer">
              <div />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ceasa__btn-cancelar" onClick={() => setMotivoPrompt(null)}>Cancelar</button>
                <button
                  className="ceasa__btn-salvar"
                  disabled={!motivoPrompt.motivo.trim()}
                  onClick={() => { aplicarMudancaEtapa(motivoPrompt.ceasaId, 'sem_interesse', motivoPrompt.motivo); setMotivoPrompt(null); }}
                >Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
