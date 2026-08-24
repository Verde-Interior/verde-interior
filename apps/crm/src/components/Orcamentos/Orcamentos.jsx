// src/components/Orcamentos/Orcamentos.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useCRM } from '../../context/CRMContext';
import GeradorOrcamento from './GeradorOrcamento/GeradorOrcamento';
import './Orcamentos.css';

const TIPO_LABEL = {
  'venda':     'Venda',
  'reforma':   'Reforma',
  'locacao':   'Locação',
  'manut-rec': 'Manutenção Recorrente',
  'manut-pont':'Manutenção Pontual',
  'eventos':   'Eventos',
  'outros':    'Outros',
};

const STATUS_LABEL = {
  rascunho: 'Rascunho',
  enviado:  'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

const STATUS_COR = {
  rascunho: 'cinza',
  enviado:  'azul',
  aprovado: 'verde',
  recusado: 'vermelho',
};

function fmt(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Orcamentos({ onNavegar }) {
  const { leads } = useCRM();

  const [lista, setLista]             = useState([]);
  const [carregando, setCarregando]   = useState(true);
  const [orcamentoId, setOrcamentoId] = useState(null);
  const [leadInicial, setLeadInicial] = useState(null);
  const [vista, setVista]             = useState('lista');

  // filtros
  const [busca, setBusca]             = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo]   = useState('');

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('orcamentos')
      .select(`
        id, nome, tipo_servico, tipos_servico, status, criado_por, criado_em, atualizado_em,
        lead_id, dados_cliente,
        orcamento_opcoes(total_unico, total_mensal)
      `)
      .order('atualizado_em', { ascending: false });

    if (!error) {
      const comTotais = (data ?? []).map(o => {
        const totalUnico  = o.orcamento_opcoes.reduce((s, op) => s + (op.total_unico  ?? 0), 0);
        const totalMensal = o.orcamento_opcoes.reduce((s, op) => s + (op.total_mensal ?? 0), 0);
        const lead = leads.find(l => l.id === o.lead_id);
        return { ...o, totalUnico, totalMensal, leadNome: lead?.empresa ?? o.dados_cliente?.empresa ?? '—' };
      });
      setLista(comTotais);
    }
    setCarregando(false);
  }, [leads]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  function abrirNovo(lead = null) {
    setLeadInicial(lead);
    setOrcamentoId(null);
    setVista('gerador');
  }

  // Consome o payload gravado pelo LeadCard no sessionStorage e abre o editor
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('orc-lead-inicial');
      if (raw) {
        sessionStorage.removeItem('orc-lead-inicial');
        abrirNovo(JSON.parse(raw));
      }
    } catch {}
  }, []);

  function abrirExistente(id) {
    setLeadInicial(null);
    setOrcamentoId(id);
    setVista('gerador');
  }

  function voltarParaLista() {
    setVista('lista');
    setOrcamentoId(null);
    setLeadInicial(null);
    carregarLista();
  }

  if (vista === 'gerador') {
    return (
      <GeradorOrcamento
        orcamentoId={orcamentoId}
        leadInicial={leadInicial}
        onVoltar={voltarParaLista}
      />
    );
  }

  // ── filtros aplicados ──
  const listaFiltrada = lista.filter(o => {
    if (filtroStatus && o.status !== filtroStatus) return false;
    if (filtroTipo   && o.tipo_servico !== filtroTipo && !(o.tipos_servico ?? []).includes(filtroTipo)) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!o.nome.toLowerCase().includes(q) && !o.leadNome.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // métricas rápidas
  const totalEnviados  = lista.filter(o => o.status === 'enviado').length;
  const totalAprovados = lista.filter(o => o.status === 'aprovado').length;
  const valorAberto    = lista.filter(o => o.status === 'enviado').reduce((s, o) => s + o.totalUnico + o.totalMensal, 0);
  const taxaConversao  = totalEnviados > 0 ? Math.round((totalAprovados / (totalEnviados + totalAprovados)) * 100) : 0;

  return (
    <div className="orc-lista">
      {/* ── cabeçalho ── */}
      <div className="orc-lista__header">
        <div className="orc-lista__titulo-area">
          <h1 className="orc-lista__titulo">Orçamentos</h1>
          <span className="orc-lista__contagem">{lista.length} proposta{lista.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="orc-lista__btn-novo" onClick={() => abrirNovo()}>
          + Novo Orçamento
        </button>
      </div>

      {/* ── métricas ── */}
      <div className="orc-lista__metricas">
        <div className="orc-lista__metrica">
          <span className="orc-lista__metrica-valor">{totalEnviados}</span>
          <span className="orc-lista__metrica-label">Em aberto</span>
        </div>
        <div className="orc-lista__metrica">
          <span className="orc-lista__metrica-valor orc-lista__metrica-valor--verde">{totalAprovados}</span>
          <span className="orc-lista__metrica-label">Aprovados</span>
        </div>
        <div className="orc-lista__metrica">
          <span className="orc-lista__metrica-valor">{fmt(valorAberto)}</span>
          <span className="orc-lista__metrica-label">Valor em aberto</span>
        </div>
        <div className="orc-lista__metrica">
          <span className="orc-lista__metrica-valor">{taxaConversao}%</span>
          <span className="orc-lista__metrica-label">Taxa de aprovação</span>
        </div>
      </div>

      {/* ── filtros ── */}
      <div className="orc-lista__filtros">
        <input
          className="orc-lista__busca"
          type="search"
          placeholder="Buscar por nome ou empresa..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className="orc-lista__select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="orc-lista__select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* ── tabela ── */}
      {carregando ? (
        <div className="orc-lista__vazio">Carregando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div className="orc-lista__vazio">
          {lista.length === 0
            ? 'Nenhum orçamento criado ainda. Clique em "+ Novo Orçamento" para começar.'
            : 'Nenhum orçamento corresponde aos filtros aplicados.'}
        </div>
      ) : (
        <div className="orc-lista__tabela-wrap">
          <table className="orc-lista__tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Empresa / Lead</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Total Único</th>
                <th>Total Mensal</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(o => (
                <tr key={o.id} className="orc-lista__linha" onClick={() => abrirExistente(o.id)}>
                  <td className="orc-lista__cell-nome">{o.nome}</td>
                  <td>{o.leadNome}</td>
                  <td>{(o.tipos_servico?.length > 1) ? o.tipos_servico.map(t => TIPO_LABEL[t] ?? t).join(' + ') : (TIPO_LABEL[o.tipo_servico] ?? o.tipo_servico ?? '—')}</td>
                  <td>
                    <span className={`orc-lista__badge orc-lista__badge--${STATUS_COR[o.status]}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td>{o.totalUnico > 0 ? fmt(o.totalUnico) : '—'}</td>
                  <td>{o.totalMensal > 0 ? fmt(o.totalMensal) : '—'}</td>
                  <td>{fmtData(o.atualizado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
