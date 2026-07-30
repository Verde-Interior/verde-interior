// src/components/CeasaHolambra/CeasaHolambra.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast/Toast';
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
  const [modal, setModal]         = useState(null); // null | { modo: 'add'|'edit', dados }
  const [salvando, setSalvando]   = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('ceasa_prospects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.erro('Erro ao carregar prospects'); return; }
    setProspects(data ?? []);
  }, [toast]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirAdd() {
    setModal({ modo: 'add', dados: { ...VAZIO } });
  }

  function abrirEdit(p) {
    setModal({ modo: 'edit', dados: { ...p } });
  }

  function fechar() { setModal(null); }

  function setField(campo, valor) {
    setModal(m => ({ ...m, dados: { ...m.dados, [campo]: valor } }));
  }

  async function salvar() {
    const d = modal.dados;
    if (!d.nome_loja.trim()) { toast.erro('Informe o nome da loja'); return; }
    setSalvando(true);
    try {
      if (modal.modo === 'add') {
        const { error } = await supabase.from('ceasa_prospects').insert({
          nome_loja: d.nome_loja.trim(), responsavel: d.responsavel || null,
          telefone: d.telefone || null, whatsapp: d.whatsapp || null,
          tipo: d.tipo, produtos_interesse: d.produtos_interesse || null,
          observacoes: d.observacoes || null, endereco: d.endereco || null,
          etapa: d.etapa,
        });
        if (error) throw error;
        toast.ok(`${d.nome_loja} adicionada`);
      } else {
        const { error } = await supabase.from('ceasa_prospects').update({
          nome_loja: d.nome_loja.trim(), responsavel: d.responsavel || null,
          telefone: d.telefone || null, whatsapp: d.whatsapp || null,
          tipo: d.tipo, produtos_interesse: d.produtos_interesse || null,
          observacoes: d.observacoes || null, endereco: d.endereco || null,
          etapa: d.etapa,
        }).eq('id', d.id);
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

  async function excluir() {
    if (!confirm(`Excluir "${modal.dados.nome_loja}"?`)) return;
    const { error } = await supabase.from('ceasa_prospects').delete().eq('id', modal.dados.id);
    if (error) { toast.erro('Erro ao excluir'); return; }
    toast.ok('Prospect excluído');
    fechar();
    carregar();
  }

  const filtrados = prospects.filter(p => {
    const q = busca.toLowerCase();
    return !q || p.nome_loja?.toLowerCase().includes(q) || p.responsavel?.toLowerCase().includes(q);
  });

  return (
    <div className="ceasa">
      {/* ── Topbar ── */}
      <div className="ceasa__topbar">
        <div>
          <div className="ceasa__titulo">Ceasa / Holambra</div>
          <div className="ceasa__sub">{prospects.length} prospect{prospects.length !== 1 ? 's' : ''} cadastrado{prospects.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="ceasa__topbar-acoes">
          <input
            className="ceasa__busca"
            placeholder="Buscar loja ou responsável..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <button className="ceasa__btn-add" onClick={abrirAdd}>
            + Nova Loja
          </button>
        </div>
      </div>

      {/* ── Kanban ── */}
      <div className="ceasa__kanban">
        {ETAPAS.map(etapa => {
          const cards = filtrados.filter(p => p.etapa === etapa.id);
          return (
            <div key={etapa.id} className="ceasa__coluna">
              <div className="ceasa__col-header">
                <span className="ceasa__col-titulo">
                  <span className="ceasa__col-dot" style={{ background: etapa.cor }} />
                  {etapa.label}
                </span>
                <span className="ceasa__col-count">{cards.length}</span>
              </div>
              <div className="ceasa__col-cards">
                {cards.length === 0 && (
                  <div className="ceasa__vazio">
                    <span>—</span>
                  </div>
                )}
                {cards.map(p => (
                  <div key={p.id} className="ceasa__card" onClick={() => abrirEdit(p)}>
                    <div className="ceasa__card-nome">{p.nome_loja}</div>
                    <span className="ceasa__card-tipo">{p.tipo}</span>
                    {p.responsavel && (
                      <div className="ceasa__card-info">👤 {p.responsavel}</div>
                    )}
                    {p.telefone && (
                      <div className="ceasa__card-info">📞 {p.telefone}</div>
                    )}
                    {p.produtos_interesse && (
                      <div className="ceasa__card-info" style={{ marginTop: 4 }}>🌿 {p.produtos_interesse}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="ceasa__overlay" onClick={e => e.target === e.currentTarget && fechar()}>
          <div className="ceasa__modal">
            <div className="ceasa__modal-header">
              <span className="ceasa__modal-titulo">
                {modal.modo === 'add' ? 'Nova Loja' : 'Editar Loja'}
              </span>
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
              {modal.modo === 'edit' ? (
                <button className="ceasa__btn-excluir" onClick={excluir}>Excluir</button>
              ) : (
                <div />
              )}
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
