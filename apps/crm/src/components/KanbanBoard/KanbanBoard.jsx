// src/components/KanbanBoard/KanbanBoard.jsx
import { useState, useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import KanbanColumn from '../KanbanColumn/KanbanColumn';
import AddLeadModal from '../AddLeadModal/AddLeadModal';
import SugestoesDropdown from '../SugestoesDropdown/SugestoesDropdown';
import './KanbanBoard.css';

const ORDENACOES = [
  { value: 'entrada',    label: 'Mais recentes' },
  { value: 'valor-desc', label: 'Maior valor'   },
  { value: 'valor-asc',  label: 'Menor valor'   },
  { value: 'followup',   label: 'Follow-up'     },
  { value: 'empresa',    label: 'A–Z Empresa'   },
];

export default function KanbanBoard() {
  const { ESTAGIOS, TIPOS_SERVICO, leads, metricas, getTiposServico, abrirModal } = useCRM();

  const [busca, setBusca]                 = useState('');
  const [filtroServico, setFiltroServico] = useState('todos');
  const [filtroCanal, setFiltroCanal]     = useState('todos');
  const [ordenacao, setOrdenacao]         = useState('entrada');
  const [addAberto, setAddAberto]         = useState(false);
  const [modoVista, setModoVista]         = useState('kanban'); // 'kanban' | 'lista'
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [indiceSugestao,   setIndiceSugestao]   = useState(0);

  const leadsFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    let lista = leads.filter((l) => {
      const okBusca   = !q || l.empresa?.toLowerCase().includes(q) || l.contato?.toLowerCase().includes(q) || l.bairro?.toLowerCase().includes(q);
      const okServico = filtroServico === 'todos' || getTiposServico(l).includes(filtroServico);
      const okCanal   = filtroCanal   === 'todos' || l.canalOrigem === filtroCanal;
      return okBusca && okServico && okCanal;
    });

    // Ordenação dentro de cada coluna
    lista = [...lista].sort((a, b) => {
      if (ordenacao === 'valor-desc') return (b.valorEstimado ?? 0) - (a.valorEstimado ?? 0);
      if (ordenacao === 'valor-asc')  return (a.valorEstimado ?? 0) - (b.valorEstimado ?? 0);
      if (ordenacao === 'empresa')    return (a.empresa ?? '').localeCompare(b.empresa ?? '');
      if (ordenacao === 'followup') {
        if (!a.proximoFollowUp) return 1;
        if (!b.proximoFollowUp) return -1;
        return a.proximoFollowUp.localeCompare(b.proximoFollowUp);
      }
      // default: entrada (mais recente primeiro)
      return (b.dataEntrada ?? '').localeCompare(a.dataEntrada ?? '');
    });

    return lista;
    // getTiposServico é helper estável do CRMContext — não muda entre renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, busca, filtroServico, filtroCanal, ordenacao]);

  const sugestoes = useMemo(() => {
    if (!busca.trim()) return [];
    return leadsFiltrados.slice(0, 8).map((l) => ({ id: l.id, label: l.empresa, sublabel: l.bairro, _lead: l }));
  }, [leadsFiltrados, busca]);

  function selecionarSugestao(item) {
    setSugestoesAbertas(false);
    abrirModal(item._lead);
  }

  function onBuscaKeyDown(e) {
    if (!sugestoesAbertas || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSugestao((i) => Math.min(i + 1, sugestoes.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setIndiceSugestao((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); selecionarSugestao(sugestoes[indiceSugestao]); }
    else if (e.key === 'Escape')    { setSugestoesAbertas(false); }
  }

  const temFiltro = busca || filtroServico !== 'todos' || filtroCanal !== 'todos';

  const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="kanban-board">
      {/* ── Topbar ── */}
      <header className="kanban-board__topbar">
        <div className="kanban-board__topbar-esq">
          <h1 className="kanban-board__titulo">Pipeline de Vendas</h1>
          <div className="kanban-board__metricas">
            <span className="kanban-board__metrica"><strong>{metricas.totalLeads}</strong> leads</span>
            <span className="kanban-board__sep">·</span>
            <span className="kanban-board__metrica"><strong>{fmt(metricas.valorPipeline)}</strong> em aberto</span>
            <span className="kanban-board__sep">·</span>
            <span className="kanban-board__metrica kanban-board__metrica--destaque">
              <strong>{metricas.taxaConversao}%</strong> conversão
            </span>
          </div>
        </div>
        <div className="kanban-board__topbar-acoes">
          <div className="kanban-board__vista-toggle">
            <button
              className={`kanban-board__vista-btn ${modoVista === 'kanban' ? 'kanban-board__vista-btn--ativo' : ''}`}
              onClick={() => setModoVista('kanban')}
              title="Visualização Kanban"
            >
              ⠿ Kanban
            </button>
            <button
              className={`kanban-board__vista-btn ${modoVista === 'lista' ? 'kanban-board__vista-btn--ativo' : ''}`}
              onClick={() => setModoVista('lista')}
              title="Visualização Lista"
            >
              ☰ Lista
            </button>
          </div>
          <button className="kanban-board__btn-add" onClick={() => setAddAberto(true)}>
            + Novo Lead
          </button>
        </div>
      </header>

      {/* ── Filtros ── */}
      <div className="kanban-board__filtros">
        <div className="kanban-board__busca-wrapper">
          <span className="kanban-board__busca-icon">⌕</span>
          <input
            className="kanban-board__busca"
            placeholder="Buscar empresa, contato ou bairro..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setSugestoesAbertas(true); setIndiceSugestao(0); }}
            onFocus={() => busca.trim() && setSugestoesAbertas(true)}
            onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
            onKeyDown={onBuscaKeyDown}
            autoComplete="off"
          />
          {busca && (
            <button className="kanban-board__busca-limpar" onClick={() => setBusca('')}>✕</button>
          )}
          {sugestoesAbertas && busca.trim() && (
            <SugestoesDropdown itens={sugestoes} indiceAtivo={indiceSugestao} onSelecionar={selecionarSugestao} onHover={setIndiceSugestao} />
          )}
        </div>

        <select className="kanban-board__select" value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)}>
          <option value="todos">Todos os serviços</option>
          {Object.entries(TIPOS_SERVICO).map(([key, svc]) => (
            <option key={key} value={key}>{svc.label}</option>
          ))}
        </select>

        <select className="kanban-board__select" value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value)}>
          <option value="todos">Todos os canais</option>
          <option value="WhatsApp">💬 WhatsApp</option>
          <option value="E-mail">✉️ E-mail</option>
          <option value="Telefone">📞 Telefone</option>
        </select>

        <select className="kanban-board__select" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>
          {ORDENACOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {temFiltro && (
          <button className="kanban-board__limpar-filtros" onClick={() => { setBusca(''); setFiltroServico('todos'); setFiltroCanal('todos'); }}>
            Limpar filtros
          </button>
        )}
        {temFiltro && (
          <span className="kanban-board__resultado">
            {leadsFiltrados.length} resultado{leadsFiltrados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Conteúdo: Kanban ou Lista ── */}
      {modoVista === 'kanban' ? (
        <div className="kanban-board__colunas">
          {ESTAGIOS.map((estagio) => (
            <KanbanColumn key={estagio.id} estagio={estagio} leadsFiltrados={leadsFiltrados} />
          ))}
        </div>
      ) : (
        <div className="kanban-board__lista-wrap">
          <table className="kanban-board__lista-tabela">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contato</th>
                <th>Serviço</th>
                <th>Bairro</th>
                <th>Valor</th>
                <th>Estágio</th>
                <th>Follow-up</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.length === 0 ? (
                <tr><td colSpan={8} className="kanban-board__lista-vazio">Nenhum lead encontrado</td></tr>
              ) : (
                leadsFiltrados.map((lead) => {
                  const tipos  = getTiposServico(lead);
                  const svcs   = tipos.map((t) => ({ id: t, ...TIPOS_SERVICO[t] })).filter((s) => s.label);
                  const isRec  = svcs.some((s) => s.faturamento === 'recorrente');
                  const estagio = ESTAGIOS.find((e) => e.id === lead.estagioId);
                  const hoje   = new Date().toISOString().split('T')[0];
                  const fuAtrasado = lead.proximoFollowUp && lead.proximoFollowUp < hoje;
                  const fuHoje     = lead.proximoFollowUp === hoje;
                  return (
                    <tr key={lead.id} className="kanban-board__lista-linha" onClick={() => abrirModal(lead)}>
                      <td className="kanban-board__lista-empresa">
                        <span className="kanban-board__lista-nome">{lead.empresa}</span>
                      </td>
                      <td className="kanban-board__lista-contato">{lead.contato}</td>
                      <td>
                        {svcs.length === 0 ? (
                          <span className="kanban-board__lista-badge" style={{ '--badge-cor': '#6B7280' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {svcs.map((s) => (
                              <span key={s.id} className="kanban-board__lista-badge" style={{ '--badge-cor': s.cor }}>
                                {s.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="kanban-board__lista-bairro">📍 {lead.bairro}</td>
                      <td className="kanban-board__lista-valor">
                        {fmt(lead.valorEstimado ?? 0)}
                        {isRec && <span className="kanban-board__lista-recorrencia">/mês</span>}
                      </td>
                      <td>
                        <span className="kanban-board__lista-estagio" style={{ '--est-cor': estagio?.cor ?? '#6B7280' }}>
                          {estagio?.label ?? lead.estagioId}
                        </span>
                      </td>
                      <td>
                        {lead.proximoFollowUp ? (
                          <span className={`kanban-board__lista-fu ${fuAtrasado ? 'kanban-board__lista-fu--atrasado' : fuHoje ? 'kanban-board__lista-fu--hoje' : ''}`}>
                            {fuAtrasado ? '⚠ ' : fuHoje ? '🔔 ' : ''}
                            {new Date(lead.proximoFollowUp + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        ) : (
                          <span className="kanban-board__lista-fu--vazio">—</span>
                        )}
                      </td>
                      <td>
                        {lead.telefone && (
                          <a
                            href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="kanban-board__lista-wa"
                            onClick={(e) => e.stopPropagation()}
                          >
                            💬
                          </a>
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

      <AddLeadModal aberto={addAberto} onFechar={() => setAddAberto(false)} />
    </div>
  );
}
