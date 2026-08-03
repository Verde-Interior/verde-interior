// src/components/CeasaHolambra/CeasaHolambra.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast/Toast';
import CeasaCard from './CeasaCard';
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

const TIPOS = ['atacadista', 'varejista', 'floricultura', 'outros'];

const VAZIO = {
  nome_loja: '', responsavel: '', telefone: '', whatsapp: '',
  tipo: 'atacadista', produtos_interesse: '', observacoes: '', endereco: '',
  etapa: 'prospecto',
};

export default function CeasaHolambra() {
  const toast = useToast();
  const [prospects, setProspects] = useState([]);
  const [busca, setBusca]         = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modoVista, setModoVista] = useState('kanban');
  const [modal, setModal]         = useState(null);
  const [salvando, setSalvando]   = useState(false);
  const [dragId, setDragId]       = useState(null);
  const [dragOver, setDragOver]   = useState(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('ceasa_prospects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.erro('Erro ao carregar'); return; }
    setProspects(data ?? []);
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
    const okBusca = !q || p.nome_loja?.toLowerCase().includes(q) || p.responsavel?.toLowerCase().includes(q) || p.endereco?.toLowerCase().includes(q);
    const okTipo  = filtroTipo === 'todos' || p.tipo === filtroTipo;
    return okBusca && okTipo;
  });

  const temFiltro = busca || filtroTipo !== 'todos';

  // ── Modal ──
  function abrirAdd()   { setModal({ modo: 'add',  dados: { ...VAZIO } }); }
  function abrirEdit(p) { setModal({ modo: 'edit', dados: { ...p } }); }
  function fechar()     { setModal(null); }
  function setField(k, v) { setModal(m => ({ ...m, dados: { ...m.dados, [k]: v } })); }

  async function salvar() {
    const d = modal.dados;
    if (!d.nome_loja.trim()) { toast.erro('Informe o nome da loja'); return; }
    setSalvando(true);
    try {
      const payload = {
        nome_loja: d.nome_loja.trim(), responsavel: d.responsavel || null,
        telefone: d.telefone || null, whatsapp: d.whatsapp || null,
        tipo: d.tipo, produtos_interesse: d.produtos_interesse || null,
        observacoes: d.observacoes || null, endereco: d.endereco || null,
        etapa: d.etapa,
      };
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
  async function moverParaEtapa(ceasaId, novaEtapa) {
    setProspects(prev => prev.map(p => p.id === ceasaId ? { ...p, etapa: novaEtapa } : p));
    const { error } = await supabase.from('ceasa_prospects').update({ etapa: novaEtapa }).eq('id', ceasaId);
    if (error) { toast.erro('Erro ao mover'); carregar(); }
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
            placeholder="Buscar loja, responsável ou endereço..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button className="kanban-board__busca-limpar" onClick={() => setBusca('')}>✕</button>
          )}
        </div>
        <select className="kanban-board__select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
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
                <th>Endereço</th>
                <th>Produtos</th>
                <th>Etapa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="kanban-board__lista-vazio">Nenhuma loja encontrada</td></tr>
              ) : (
                filtrados.map(p => {
                  const etapa = ETAPA_MAP[p.etapa];
                  return (
                    <tr key={p.id} className="kanban-board__lista-linha" onClick={() => abrirEdit(p)}>
                      <td className="kanban-board__lista-empresa">
                        <span className="kanban-board__lista-nome">{p.nome_loja}</span>
                      </td>
                      <td className="kanban-board__lista-contato">{p.responsavel ?? '—'}</td>
                      <td>
                        <span className="kanban-board__lista-badge" style={{ '--badge-cor': '#8B5CF6' }}>
                          {p.tipo?.charAt(0).toUpperCase() + p.tipo?.slice(1)}
                        </span>
                      </td>
                      <td className="kanban-board__lista-bairro">{p.endereco ? `📍 ${p.endereco}` : '—'}</td>
                      <td className="kanban-board__lista-contato">{p.produtos_interesse ?? '—'}</td>
                      <td>
                        <span className="kanban-board__lista-estagio" style={{ '--est-cor': etapa?.cor ?? '#6B7280' }}>
                          {etapa?.label ?? p.etapa}
                        </span>
                      </td>
                      <td>
                        {(p.whatsapp || p.telefone) && (
                          <a
                            href={`https://wa.me/55${(p.whatsapp || p.telefone).replace(/\D/g,'')}`}
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
              <div className="ceasa__grid-2">
                <div className="ceasa__campo">
                  <label>Tipo</label>
                  <select value={modal.dados.tipo} onChange={e => setField('tipo', e.target.value)}>
                    {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="ceasa__campo">
                  <label>Etapa do Funil</label>
                  <select value={modal.dados.etapa} onChange={e => setField('etapa', e.target.value)}>
                    {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="ceasa__campo">
                <label>Responsável</label>
                <input value={modal.dados.responsavel ?? ''} onChange={e => setField('responsavel', e.target.value)} placeholder="Nome do contato" />
              </div>
              <div className="ceasa__grid-2">
                <div className="ceasa__campo">
                  <label>Telefone</label>
                  <input value={modal.dados.telefone ?? ''} onChange={e => setField('telefone', e.target.value)} placeholder="(11) 9999-9999" />
                </div>
                <div className="ceasa__campo">
                  <label>WhatsApp</label>
                  <input value={modal.dados.whatsapp ?? ''} onChange={e => setField('whatsapp', e.target.value)} placeholder="(11) 9999-9999" />
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
              <div className="ceasa__campo">
                <label>Observações</label>
                <textarea value={modal.dados.observacoes ?? ''} onChange={e => setField('observacoes', e.target.value)} placeholder="Anotações sobre a loja..." />
              </div>
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
                <button className="ceasa__btn-salvar" onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
