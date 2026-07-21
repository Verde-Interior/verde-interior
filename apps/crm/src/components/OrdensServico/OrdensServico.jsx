// src/components/OrdensServico/OrdensServico.jsx
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './OrdensServico.css';

const STATUS_LABEL = {
  rascunho:     { label: 'Rascunho',    cor: '#6B7280' },
  em_execucao:  { label: 'Em execução', cor: '#3B82F6' },
  concluida:    { label: 'Concluída',   cor: '#10B981' },
  cancelada:    { label: 'Cancelada',   cor: '#EF4444' },
};

const STATUS_PROXIMO = {
  rascunho:    'em_execucao',
  em_execucao: 'concluida',
};

const ORIGEM_LABEL = {
  trigger_aprovacao: 'Auto (orçamento aprovado)',
  manual:            'Manual',
};

function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OrdensServico() {
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [atualizando, setAtualizando] = useState(null); // os.id em atualização
  const [modalOS, setModalOS] = useState(null); // OS em foco para ver detalhes

  const carregar = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('ordens_servico')
      .select(`
        id, os_id, status, origem, observacoes, criada_em, concluida_em,
        lead_id,
        cliente_id,
        leads ( empresa, contato, bairro, estagio_id ),
        clientes ( nome_empresa, contato_nome )
      `)
      .order('criada_em', { ascending: false });

    if (filtroStatus !== 'todos') query.eq('status', filtroStatus);

    const { data, error } = await query;
    if (!error) setOrdens(data ?? []);
    setLoading(false);
  }, [filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  async function avancarStatus(os) {
    const proximo = STATUS_PROXIMO[os.status];
    if (!proximo) return;
    setAtualizando(os.id);
    const update = { status: proximo };
    if (proximo === 'concluida') update.concluida_em = new Date().toISOString();
    const { error } = await supabase.from('ordens_servico').update(update).eq('id', os.id);
    if (!error) setOrdens(prev => prev.map(o => o.id === os.id ? { ...o, ...update } : o));
    setAtualizando(null);
  }

  async function cancelar(os) {
    if (!confirm(`Cancelar a OS ${os.os_id}?`)) return;
    setAtualizando(os.id);
    const { error } = await supabase.from('ordens_servico').update({ status: 'cancelada' }).eq('id', os.id);
    if (!error) setOrdens(prev => prev.map(o => o.id === os.id ? { ...o, status: 'cancelada' } : o));
    setAtualizando(null);
  }

  const totais = ordens.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const nomeCliente = (os) => {
    if (os.clientes?.nome_empresa) return os.clientes.nome_empresa;
    if (os.leads?.empresa) return os.leads.empresa;
    return '—';
  };

  const contato = (os) => os.clientes?.contato_nome || os.leads?.contato || '—';

  return (
    <div className="os-page">
      <header className="os-page__header">
        <div>
          <h1 className="os-page__titulo">Ordens de Serviço</h1>
          <p className="os-page__sub">
            {ordens.length} OS · {totais.em_execucao ?? 0} em execução · {totais.concluida ?? 0} concluídas
          </p>
        </div>
        <button className="os-btn os-btn--sec" onClick={carregar}>↺ Atualizar</button>
      </header>

      {/* Filtros de status */}
      <div className="os-filtros">
        {['todos', 'rascunho', 'em_execucao', 'concluida', 'cancelada'].map(s => (
          <button
            key={s}
            className={`os-filtro ${filtroStatus === s ? 'os-filtro--ativo' : ''}`}
            onClick={() => setFiltroStatus(s)}
          >
            {s === 'todos' ? 'Todos' : STATUS_LABEL[s]?.label}
            {s !== 'todos' && totais[s] != null && (
              <span className="os-filtro__count">{totais[s]}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="os-loading">Carregando...</div>
      ) : ordens.length === 0 ? (
        <div className="os-vazio">
          <p>Nenhuma OS encontrada.</p>
          <p className="os-vazio__hint">
            As OS são criadas automaticamente quando um orçamento é aprovado no Pipeline.
          </p>
        </div>
      ) : (
        <div className="os-tabela-wrap">
          <table className="os-tabela">
            <thead>
              <tr>
                <th>OS</th>
                <th>Cliente / Lead</th>
                <th>Contato</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Criada em</th>
                <th>Concluída</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordens.map(os => {
                const st = STATUS_LABEL[os.status] ?? { label: os.status, cor: '#6B7280' };
                const podeAvancar = !!STATUS_PROXIMO[os.status];
                const podeCancelar = os.status !== 'concluida' && os.status !== 'cancelada';
                const busy = atualizando === os.id;
                return (
                  <tr key={os.id} className={`os-tabela__tr os-tabela__tr--${os.status}`}>
                    <td>
                      <button
                        className="os-id-btn"
                        onClick={() => setModalOS(os)}
                        title="Ver detalhes"
                      >
                        {os.os_id}
                      </button>
                    </td>
                    <td className="os-tabela__empresa">{nomeCliente(os)}</td>
                    <td>{contato(os)}</td>
                    <td>
                      <span className="os-badge" style={{ '--os-cor': st.cor }}>{st.label}</span>
                    </td>
                    <td className="os-tabela__origem">{ORIGEM_LABEL[os.origem] ?? os.origem}</td>
                    <td>{formatarData(os.criada_em)}</td>
                    <td>{formatarData(os.concluida_em)}</td>
                    <td>
                      <div className="os-acoes">
                        {podeAvancar && (
                          <button
                            className="os-btn os-btn--prim"
                            onClick={() => avancarStatus(os)}
                            disabled={busy}
                          >
                            {busy ? '...' : STATUS_PROXIMO[os.status] === 'em_execucao' ? 'Iniciar' : 'Concluir'}
                          </button>
                        )}
                        {podeCancelar && (
                          <button
                            className="os-btn os-btn--danger"
                            onClick={() => cancelar(os)}
                            disabled={busy}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhes */}
      {modalOS && (
        <ModalDetalhesOS os={modalOS} onFechar={() => setModalOS(null)} />
      )}
    </div>
  );
}

function ModalDetalhesOS({ os, onFechar }) {
  const st = STATUS_LABEL[os.status] ?? { label: os.status, cor: '#6B7280' };
  const nomeCliente = os.clientes?.nome_empresa || os.leads?.empresa || '—';
  const bairro = os.leads?.bairro || '';
  const contato = os.clientes?.contato_nome || os.leads?.contato || '';

  const linkOS = `/os.html?${new URLSearchParams({
    os: os.os_id,
    cliente: nomeCliente,
    bairro,
    contato,
    modo: 'execucao',
  })}`;

  return (
    <div className="os-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="os-modal">
        <header className="os-modal__header">
          <div>
            <h3 className="os-modal__titulo">{os.os_id}</h3>
            <span className="os-badge" style={{ '--os-cor': st.cor }}>{st.label}</span>
          </div>
          <button className="os-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="os-modal__corpo">
          <dl className="os-dl">
            <dt>Cliente / Lead</dt>
            <dd>{nomeCliente}</dd>
            <dt>Contato</dt>
            <dd>{contato || '—'}</dd>
            <dt>Bairro</dt>
            <dd>{bairro || '—'}</dd>
            <dt>Origem</dt>
            <dd>{ORIGEM_LABEL[os.origem] ?? os.origem}</dd>
            <dt>Criada em</dt>
            <dd>{formatarData(os.criada_em)}</dd>
            {os.concluida_em && (
              <>
                <dt>Concluída em</dt>
                <dd>{formatarData(os.concluida_em)}</dd>
              </>
            )}
            {os.observacoes && (
              <>
                <dt>Observações</dt>
                <dd>{os.observacoes}</dd>
              </>
            )}
          </dl>
        </div>

        <footer className="os-modal__footer">
          <a
            className="os-btn os-btn--prim"
            href={linkOS}
            target="_blank"
            rel="noreferrer"
          >
            ↗ Abrir formulário OS
          </a>
          <button
            className="os-btn os-btn--copy"
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + linkOS);
            }}
          >
            🔗 Copiar link
          </button>
          <button className="os-btn os-btn--sec" onClick={onFechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
