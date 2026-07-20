// src/components/Dashboard/Dashboard.jsx
import { useMemo, useEffect, useRef, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { supabase } from '../../lib/supabase';
import './Dashboard.css';

function useContador(alvo, ms = 700) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (alvo === 0) { setVal(0); return; }
    let inicio = null;
    const animar = (ts) => {
      if (!inicio) inicio = ts;
      const prog = Math.min((ts - inicio) / ms, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.round(ease * alvo));
      if (prog < 1) ref.current = requestAnimationFrame(animar);
    };
    ref.current = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(ref.current);
  }, [alvo, ms]);
  return val;
}

const HOJE_LABEL = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
});

function saudacao() {
  const h    = new Date().getHours();
  const nome = localStorage.getItem('crm-nome-usuario');
  const sfx  = nome ? `, ${nome}` : '';
  if (h >= 5 && h < 12)  return `Bom dia${sfx} 👋`;
  if (h >= 12 && h < 19) return `Boa tarde${sfx} 👋`;
  return `Boa noite${sfx} 👋`;
}

function KpiCard({ label, valor, sub, destaque, onClick }) {
  return (
    <button
      className={`kpi-card ${destaque ? 'kpi-card--destaque' : ''} ${onClick ? 'kpi-card--clicavel' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="kpi-card__valor">{valor}</span>
      <span className="kpi-card__label">{label}</span>
      {sub && <span className="kpi-card__sub">{sub}</span>}
    </button>
  );
}

function DragHandle() {
  return (
    <span className="bloco__handle" title="Arraste para reorganizar">
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
        <circle cx="3" cy="2.5"  r="1.4" fill="currentColor"/>
        <circle cx="7" cy="2.5"  r="1.4" fill="currentColor"/>
        <circle cx="3" cy="7"    r="1.4" fill="currentColor"/>
        <circle cx="7" cy="7"    r="1.4" fill="currentColor"/>
        <circle cx="3" cy="11.5" r="1.4" fill="currentColor"/>
        <circle cx="7" cy="11.5" r="1.4" fill="currentColor"/>
      </svg>
    </span>
  );
}

const PRIO_COR   = { alta: '#C23B3B', media: '#C47A1A', baixa: '#3D6B1E' };
const PRIO_LABEL = { alta: 'Alta',    media: 'Média',    baixa: 'Baixa'    };
const CAT_LABEL  = {
  geral: '📌 Geral', visita: '🗺️ Visita', orcamento: '📄 Orçamento',
  followup: '📞 Follow-up', administrativo: '🗂️ Administrativo',
};
const STATUS_LABEL = { a_fazer: 'A Fazer', em_andamento: 'Em Andamento', concluida: 'Concluída' };

function statusVenc(data) {
  if (!data) return null;
  const hj = new Date().toISOString().split('T')[0];
  if (data < hj) return 'atrasada';
  if (data === hj) return 'hoje';
  return null;
}

const SECOES_PADRAO = ['grid2', 'receita', 'followups', 'leads', 'tarefas'];

// Assuntos enxutos: só ações comerciais reais do funil. Antes tinha 9 opções
// e a maioria era ruído (orientação_rega, feedback_cliente, nota_fiscal etc).
// Se precisar de algo fora dessas 4 ações, o usuário escreve na "nota rápida".
// `tipo` diferencia: "acao" = ação pendente com destaque; "lembrete" = só data.
const FU_ASSUNTO_LABEL = {
  enviar_orcamento:    { label: 'Enviar orçamento',    icone: '📄', tipo: 'acao' },
  confirmar_aprovacao: { label: 'Confirmar aprovação', icone: '✅', tipo: 'acao' },
  agendar_visita:      { label: 'Agendar visita',      icone: '📅', tipo: 'acao' },
  retornar_contato:    { label: 'Retornar contato',    icone: '📞', tipo: 'acao' },
  lembrete:            { label: 'Só lembrete',         icone: '🕐', tipo: 'lembrete' },
  // legados — mantidos para não quebrar leads antigos, mas escondidos do picker
  agendar_servico:     { label: 'Agendar serviço',     icone: '📅', tipo: 'acao',   legado: true },
  orientacao_rega:     { label: 'Orientação de rega',  icone: '💧', tipo: 'acao',   legado: true },
  responder_email:     { label: 'Responder e-mail',    icone: '📧', tipo: 'acao',   legado: true },
  nota_fiscal:         { label: 'Nota fiscal',         icone: '🧾', tipo: 'acao',   legado: true },
  renovacao_contrato:  { label: 'Renovação contrato',  icone: '🔄', tipo: 'acao',   legado: true },
  retornar_ligacao:    { label: 'Retornar ligação',    icone: '📞', tipo: 'acao',   legado: true },
  feedback_cliente:    { label: 'Feedback do cliente', icone: '💬', tipo: 'acao',   legado: true },
};

// Helper: um follow-up é "só lembrete" quando não tem nenhum assunto de ação.
function ehSoLembrete(assuntos = []) {
  if (assuntos.length === 0) return true;
  return assuntos.every((id) => FU_ASSUNTO_LABEL[id]?.tipo === 'lembrete');
}
const STORAGE_ORDEM = 'crm-verde-dashboard-ordem';

const STORAGE_ABA = 'crm-verde-dashboard-aba';

export default function Dashboard({ onNavegar }) {
  const { leads, ESTAGIOS, TIPOS_SERVICO, metricas, abrirModal, tarefas, atualizarLead, getTiposServico } = useCRM();
  const [aba, setAba] = useState(() => localStorage.getItem(STORAGE_ABA) || 'comercial');
  useEffect(() => { localStorage.setItem(STORAGE_ABA, aba); }, [aba]);

  const [estagioExpandido, setEstagioExpandido] = useState(null);
  const [filtroTarefas, setFiltroTarefas]       = useState(null);
  const [proximosAberto, setProximosAberto]     = useState(false);
  const [tarefaSelecionada, setTarefaSel]        = useState(null);
  const [reagendando, setReagendando]           = useState(null); // leadId
  const [novaDataFU, setNovaDataFU]             = useState('');
  const [arquivadosAberto, setArquivadosAberto] = useState(false);
  const [atrasadosAberto, setAtrasadosAberto]   = useState(true);
  const [hojeAberto, setHojeAberto]             = useState(true);
  const autoArquivouRef = useRef(false);
  const [, forceUpdate] = useState(0);
  const [metas, setMetas] = useState(() => {
    try {
      const s = localStorage.getItem('crm-metas');
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });

  useEffect(() => {
    function onNome() { forceUpdate((n) => n + 1); }
    window.addEventListener('crm-nome-usuario-change', onNome);
    return () => window.removeEventListener('crm-nome-usuario-change', onNome);
  }, []);

  useEffect(() => {
    function onMeta(e) { setMetas(e.detail ?? {}); }
    window.addEventListener('crm-metas-change', onMeta);
    return () => window.removeEventListener('crm-metas-change', onMeta);
  }, []);

  const [ordemSecoes, setOrdemSecoes] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_ORDEM);
      if (s) {
        const parsed = JSON.parse(s);
        // Garante que novos IDs sejam incluídos
        const todos = SECOES_PADRAO;
        const faltando = todos.filter((id) => !parsed.includes(id));
        return [...parsed, ...faltando];
      }
    } catch {}
    return SECOES_PADRAO;
  });

  const dragSrc  = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_ORDEM, JSON.stringify(ordemSecoes));
  }, [ordemSecoes]);

  useEffect(() => {
    function onReset() { setOrdemSecoes(SECOES_PADRAO); }
    window.addEventListener('crm-dashboard-reset-ordem', onReset);
    return () => window.removeEventListener('crm-dashboard-reset-ordem', onReset);
  }, []);

  function onDragStart(e, id) {
    if (e.target.closest('button, input, select, a, textarea')) { e.preventDefault(); return; }
    dragSrc.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e, id) {
    e.preventDefault();
    if (dragSrc.current && dragSrc.current !== id) setDragOver(id);
  }
  function onDragLeave() { setDragOver(null); }
  function onDrop(e, targetId) {
    e.preventDefault();
    setDragOver(null);
    const src = dragSrc.current;
    dragSrc.current = null;
    if (!src || src === targetId) return;
    setOrdemSecoes((prev) => {
      const novo = [...prev];
      const from = novo.indexOf(src);
      const to   = novo.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      novo.splice(from, 1);
      novo.splice(to, 0, src);
      return novo;
    });
  }
  function onDragEnd() { dragSrc.current = null; setDragOver(null); }

  const fmt = (n) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0,
  }).format(n);

  const animLeads       = useContador(metricas.totalLeads);
  const animPipeline    = useContador(metricas.valorPipeline);
  const animRecorrencia = useContador(metricas.recorrenciaMensal);
  const animConversao   = useContador(metricas.taxaConversao);

  // ── Auto-arquivamento (executa 1× no mount) ───────────────────────────────
  useEffect(() => {
    if (autoArquivouRef.current || leads.length === 0) return;
    autoArquivouRef.current = true;
    const hoje = new Date().toISOString().split('T')[0];
    const limite30 = new Date();
    limite30.setDate(limite30.getDate() - 30);
    const limiteStr = limite30.toISOString().split('T')[0];
    leads
      .filter((l) => l.proximoFollowUp && l.proximoFollowUp <= limiteStr)
      .forEach((l) => {
        atualizarLead(l.id, {
          proximoFollowUp:   null,
          followUpAssuntos:  [],
          followUpNota:      null,
          followUpArquivados: [
            ...(l.followUpArquivados ?? []),
            { data: l.proximoFollowUp, assuntos: l.followUpAssuntos ?? [], nota: l.followUpNota ?? null, arquivadoEm: hoje },
          ],
        });
      });
  }, [leads.length]); // eslint-disable-line

  const followUpsHoje = useMemo(() => {
    const d = new Date().toISOString().split('T')[0];
    return leads.filter((l) => l.proximoFollowUp === d);
  }, [leads]);

  const followUpsAtrasados = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];
    const limite30 = new Date();
    limite30.setDate(limite30.getDate() - 30);
    const limiteStr = limite30.toISOString().split('T')[0];
    return leads
      .filter((l) => l.proximoFollowUp && l.proximoFollowUp < hoje && l.proximoFollowUp > limiteStr)
      .sort((a, b) => a.proximoFollowUp.localeCompare(b.proximoFollowUp));
  }, [leads]);

  const followUpsProximos = useMemo(() => {
    const d = new Date().toISOString().split('T')[0];
    return leads
      .filter((l) => l.proximoFollowUp && l.proximoFollowUp > d)
      .sort((a, b) => a.proximoFollowUp.localeCompare(b.proximoFollowUp));
  }, [leads]);

  const followUpsArquivados = useMemo(() => {
    const todos = [];
    leads.forEach((l) => {
      (l.followUpArquivados ?? []).forEach((arq) => {
        todos.push({ ...arq, empresa: l.empresa, contato: l.contato, bairro: l.bairro, leadId: l.id, estagioId: l.estagioId });
      });
    });
    // agrupa por mês
    const porMes = {};
    todos.forEach((arq) => {
      const mes = arq.data?.slice(0, 7) ?? 'desconhecido';
      if (!porMes[mes]) porMes[mes] = [];
      porMes[mes].push(arq);
    });
    return Object.entries(porMes)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, itens]) => ({ mes, itens: itens.sort((a, b) => b.data.localeCompare(a.data)) }));
  }, [leads]);

  const totalArquivados = useMemo(() =>
    leads.reduce((acc, l) => acc + (l.followUpArquivados?.length ?? 0), 0)
  , [leads]);

  function diasAtraso(data) {
    const diff = Math.floor((new Date().setHours(0,0,0,0) - new Date(data + 'T12:00')) / 86400000);
    return diff;
  }

  function handleFeito(lead) {
    atualizarLead(lead.id, { proximoFollowUp: null, followUpAssuntos: [], followUpNota: null });
  }

  function handleReagendar(lead) {
    if (!novaDataFU) return;
    atualizarLead(lead.id, { proximoFollowUp: novaDataFU });
    setReagendando(null);
    setNovaDataFU('');
  }

  function mesLabel(mesStr) {
    const [ano, mes] = mesStr.split('-');
    const d = new Date(Number(ano), Number(mes) - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  const porServico = useMemo(() => {
    // Um lead pode contar em mais de um tipo (multi-serviço).
    const map = {};
    leads.forEach((l) => {
      getTiposServico(l).forEach((t) => { map[t] = (map[t] ?? 0) + 1; });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [leads, getTiposServico]);

  const porEstagio = useMemo(() =>
    ESTAGIOS.map((e) => ({
      ...e,
      count: leads.filter((l) => l.estagioId === e.id).length,
      valor: leads.filter((l) => l.estagioId === e.id).reduce((s, l) => s + (l.valorEstimado ?? 0), 0),
      leads: leads.filter((l) => l.estagioId === e.id),
    })), [leads, ESTAGIOS]);

  const recentes = useMemo(() =>
    [...leads].sort((a, b) => b.dataEntrada?.localeCompare(a.dataEntrada)).slice(0, 5),
  [leads]);

  const metricasTarefas = useMemo(() => {
    const hj = new Date().toISOString().split('T')[0];
    const abertas = tarefas.filter((t) => t.status !== 'concluida');
    return {
      atrasadas:  abertas.filter((t) => t.dataVencimento && t.dataVencimento < hj).length,
      paraHoje:   abertas.filter((t) => t.dataVencimento === hj).length,
      abertas:    abertas.length,
      concluidas: tarefas.filter((t) => t.status === 'concluida').length,
    };
  }, [tarefas]);

  const proximasTarefas = useMemo(() =>
    tarefas
      .filter((t) => t.status !== 'concluida')
      .sort((a, b) => {
        if (!a.dataVencimento && !b.dataVencimento) return 0;
        if (!a.dataVencimento) return 1;
        if (!b.dataVencimento) return -1;
        return a.dataVencimento.localeCompare(b.dataVencimento);
      })
      .slice(0, 4),
  [tarefas]);

  const estagioLabel = (id) => ESTAGIOS.find((e) => e.id === id)?.label ?? id;
  const estagioColor = (id) => ESTAGIOS.find((e) => e.id === id)?.cor ?? '#6B7280';
  const leadNome     = (id) => leads.find((l) => l.id === id)?.empresa ?? null;

  function toggleEstagio(id) { setEstagioExpandido((prev) => (prev === id ? null : id)); }
  function handleLeadClick(lead) { abrirModal(lead); }

  // ── Render de cada seção ──────────────────────────────────────────────────
  function renderSecaoContent(id) {
    switch (id) {

      case 'grid2':
        return (
          <div className="dashboard__grid-2">
            <section className="dashboard__secao dashboard__card">
              <h2 className="dashboard__secao-titulo">Funil de Vendas</h2>
              <div className="dashboard__funil">
                {porEstagio.map((e) => (
                  <div key={e.id}>
                    <div
                      className={`funil-linha ${estagioExpandido === e.id ? 'funil-linha--ativo' : ''}`}
                      onClick={() => toggleEstagio(e.id)}
                    >
                      <div className="funil-linha__info">
                        <span className="funil-linha__dot" style={{ background: e.cor }} />
                        <span className="funil-linha__label">{e.label}</span>
                      </div>
                      <div className="funil-linha__direita">
                        <span className="funil-linha__count">{e.count}</span>
                        {e.valor > 0 && <span className="funil-linha__valor">{fmt(e.valor)}</span>}
                        {e.count > 0 && (
                          <span className={`funil-linha__chevron ${estagioExpandido === e.id ? 'funil-linha__chevron--aberto' : ''}`}>›</span>
                        )}
                      </div>
                    </div>
                    <div className={`funil-expandido-wrap ${estagioExpandido === e.id && e.leads.length > 0 ? 'funil-expandido-wrap--aberto' : ''}`}>
                      <div className="funil-expandido">
                        {e.leads.map((lead) => (
                          <div key={lead.id} className="funil-expandido__item" onClick={() => handleLeadClick(lead)}>
                            <span className="funil-expandido__empresa">{lead.empresa}</span>
                            <span className="funil-expandido__contato">{lead.contato}</span>
                            {lead.valorEstimado > 0 && (
                              <span className="funil-expandido__valor">{fmt(lead.valorEstimado)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="dashboard__secao dashboard__card">
              <h2 className="dashboard__secao-titulo">Mix de Serviços</h2>
              <div className="dashboard__servicos">
                {porServico.map(([tipo, count]) => {
                  const svc = TIPOS_SERVICO[tipo];
                  const pct = Math.round((count / leads.length) * 100);
                  return (
                    <div key={tipo} className="servico-barra">
                      <div className="servico-barra__header">
                        <span className="servico-barra__nome">{svc?.label ?? tipo}</span>
                        <span className="servico-barra__pct">{count} · {pct}%</span>
                      </div>
                      <div className="servico-barra__track">
                        <div className="servico-barra__fill" style={{ width: `${pct}%`, background: svc?.cor ?? '#6B7280' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        );

      case 'followups': {
        const temAlgum = followUpsAtrasados.length > 0 || followUpsHoje.length > 0 || followUpsProximos.length > 0 || totalArquivados > 0;
        if (!temAlgum) return null;

        const renderAssuntos = (assuntos) => assuntos.length > 0 && (
          <div className="followup-item__assuntos">
            {assuntos.map((id) => {
              const a = FU_ASSUNTO_LABEL[id];
              return a ? <span key={id} className="followup-item__assunto-pill">{a.icone} {a.label}</span> : null;
            })}
          </div>
        );

        return (
          <section className="dashboard__secao dashboard__card dashboard__card--alerta">

            {/* ── Em Atraso ── */}
            {followUpsAtrasados.length > 0 && (
              <div className="dashboard__fu-bloco dashboard__fu-bloco--atraso">
                <button className="dashboard__fu-toggle dashboard__fu-toggle--atraso" onClick={() => setAtrasadosAberto((v) => !v)}>
                  <span className="dashboard__fu-toggle-left">
                    ⚠ Follow-ups em Atraso
                    <span className="dashboard__badge-perigo">{followUpsAtrasados.length}</span>
                  </span>
                  <span className={`dashboard__fu-chevron ${atrasadosAberto ? 'dashboard__fu-chevron--aberto' : ''}`}>›</span>
                </button>
                <div className={`dashboard__fu-conteudo ${atrasadosAberto ? 'dashboard__fu-conteudo--aberto' : ''}`}>
                  <div className="dashboard__fu-conteudo-inner dashboard__followups">
                  {followUpsAtrasados.map((l) => {
                    const dias = diasAtraso(l.proximoFollowUp);
                    const emReagendar = reagendando === l.id;
                    const soLembrete = ehSoLembrete(l.followUpAssuntos);
                    return (
                      <div key={l.id} className={`followup-item followup-item--atraso ${soLembrete ? 'followup-item--lembrete' : 'followup-item--acao'}`}>
                        <div className="followup-item__info" onClick={() => handleLeadClick(l)} style={{ cursor: 'pointer' }}>
                          <div className="followup-item__topo">
                            <p className="followup-item__empresa">{l.empresa}</p>
                            <span className="followup-item__dias-atraso">{dias}d em atraso</span>
                            {soLembrete && <span className="followup-item__tag-lembrete">🕐 Lembrete</span>}
                          </div>
                          <p className="followup-item__contato">{l.contato} · {l.bairro}</p>
                          {renderAssuntos(l.followUpAssuntos ?? [])}
                          {l.followUpNota && <p className="followup-item__nota">"{l.followUpNota}"</p>}
                        </div>
                        <div className="followup-item__acoes">
                          {emReagendar ? (
                            <div className="followup-item__reagendar">
                              <input
                                type="date"
                                className="followup-item__reagendar-input"
                                value={novaDataFU}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setNovaDataFU(e.target.value)}
                              />
                              <button className="followup-item__btn followup-item__btn--confirmar" onClick={() => handleReagendar(l)}>✓</button>
                              <button className="followup-item__btn followup-item__btn--cancelar" onClick={() => { setReagendando(null); setNovaDataFU(''); }}>✕</button>
                            </div>
                          ) : (
                            <>
                              <button className="followup-item__btn followup-item__btn--reagendar" onClick={() => { setReagendando(l.id); setNovaDataFU(''); }}>
                                📅 Reagendar
                              </button>
                              <button className="followup-item__btn followup-item__btn--feito" onClick={() => handleFeito(l)}>
                                ✓ Feito
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Follow-ups de Hoje ── */}
            {followUpsHoje.length > 0 && (
              <div className={`dashboard__fu-bloco ${followUpsAtrasados.length > 0 ? 'dashboard__fu-bloco--separado' : ''}`}>
                <button className="dashboard__fu-toggle" onClick={() => setHojeAberto((v) => !v)}>
                  <span className="dashboard__fu-toggle-left">
                    🔔 Follow-ups de Hoje
                    <span className="dashboard__badge-alerta">{followUpsHoje.length}</span>
                  </span>
                  <span className={`dashboard__fu-chevron ${hojeAberto ? 'dashboard__fu-chevron--aberto' : ''}`}>›</span>
                </button>
                <div className={`dashboard__fu-conteudo ${hojeAberto ? 'dashboard__fu-conteudo--aberto' : ''}`}>
                  <div className="dashboard__fu-conteudo-inner dashboard__followups">
                    {followUpsHoje.map((l) => {
                      const soLembrete = ehSoLembrete(l.followUpAssuntos);
                      return (
                        <div key={l.id} className={`followup-item followup-item--clicavel ${soLembrete ? 'followup-item--lembrete' : 'followup-item--acao'}`} onClick={() => handleLeadClick(l)}>
                          <div className="followup-item__info">
                            <div className="followup-item__topo">
                              <p className="followup-item__empresa">{l.empresa}</p>
                              {soLembrete && <span className="followup-item__tag-lembrete">🕐 Lembrete</span>}
                            </div>
                            <p className="followup-item__contato">{l.contato} · {l.bairro}</p>
                            {renderAssuntos(l.followUpAssuntos ?? [])}
                            {l.followUpNota && <p className="followup-item__nota">"{l.followUpNota}"</p>}
                          </div>
                          <span className="followup-item__estagio" style={{ '--est-cor': estagioColor(l.estagioId) }}>
                            {estagioLabel(l.estagioId)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Próximos Follow-ups ── */}
            {followUpsProximos.length > 0 && (
              <div className="dashboard__fu-bloco dashboard__fu-bloco--separado">
                <button className="dashboard__fu-toggle" onClick={() => setProximosAberto((v) => !v)}>
                  <span className="dashboard__fu-toggle-left">
                    📅 Próximos Follow-ups
                    <span className="dashboard__fu-toggle-meta">{followUpsProximos.length} agendado{followUpsProximos.length > 1 ? 's' : ''}</span>
                  </span>
                  <span className={`dashboard__fu-chevron ${proximosAberto ? 'dashboard__fu-chevron--aberto' : ''}`}>›</span>
                </button>
                <div className={`dashboard__fu-conteudo ${proximosAberto ? 'dashboard__fu-conteudo--aberto' : ''}`}>
                  <div className="dashboard__fu-conteudo-inner dashboard__followups">
                    {followUpsProximos.map((l) => {
                      const dataFmt = new Date(l.proximoFollowUp + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
                      const soLembrete = ehSoLembrete(l.followUpAssuntos);
                      return (
                        <div key={l.id} className={`followup-item followup-item--clicavel followup-item--proximo ${soLembrete ? 'followup-item--lembrete' : 'followup-item--acao'}`} onClick={() => handleLeadClick(l)}>
                          <div className="followup-item__info">
                            <div className="followup-item__topo">
                              <p className="followup-item__empresa">{l.empresa}</p>
                              {soLembrete && <span className="followup-item__tag-lembrete">🕐 Lembrete</span>}
                            </div>
                            <p className="followup-item__contato">{l.contato} · {l.bairro}</p>
                            {renderAssuntos(l.followUpAssuntos ?? [])}
                            {l.followUpNota && <p className="followup-item__nota">"{l.followUpNota}"</p>}
                          </div>
                          <div className="followup-item__direita">
                            <span className="followup-item__data-pill">{dataFmt}</span>
                            <span className="followup-item__estagio" style={{ '--est-cor': estagioColor(l.estagioId) }}>
                              {estagioLabel(l.estagioId)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Botão Arquivados ── */}
            {totalArquivados > 0 && (
              <div className="dashboard__fu-arquivados-bar">
                <button className="dashboard__fu-arquivados-btn" onClick={() => setArquivadosAberto(true)}>
                  📁 Ver Follow-ups Arquivados
                  <span className="dashboard__fu-arquivados-count">{totalArquivados}</span>
                </button>
              </div>
            )}

          </section>
        );
      }

      case 'leads':
        return (
          <section className="dashboard__secao dashboard__card">
            <div className="dashboard__card-header">
              <h2 className="dashboard__secao-titulo">Leads Recentes</h2>
              <button className="dashboard__ver-todos" onClick={() => onNavegar('kanban')}>Ver Pipeline →</button>
            </div>
            <table className="dashboard__tabela">
              <thead>
                <tr>
                  <th>Empresa</th><th>Serviço</th><th>Bairro</th><th>Valor</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((l) => {
                  const tipos = getTiposServico(l);
                  const svcs  = tipos.map((t) => ({ id: t, ...TIPOS_SERVICO[t] })).filter((s) => s.label);
                  const isRec = svcs.some((s) => s.faturamento === 'recorrente');
                  return (
                    <tr key={l.id} className="tabela__linha-clicavel" onClick={() => handleLeadClick(l)}>
                      <td>
                        <div className="tabela__empresa">{l.empresa}</div>
                        <div className="tabela__contato">{l.contato}</div>
                      </td>
                      <td>
                        {svcs.length === 0 ? (
                          <span className="tabela__badge" style={{ '--badge-cor': '#6B7280' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {svcs.map((s) => (
                              <span key={s.id} className="tabela__badge" style={{ '--badge-cor': s.cor }}>
                                {s.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="tabela__bairro">{l.bairro}</td>
                      <td className="tabela__valor">
                        {fmt(l.valorEstimado ?? 0)}
                        {isRec && <span className="tabela__recorrencia">/mês</span>}
                      </td>
                      <td>
                        <span className="tabela__estagio" style={{ '--est-cor': estagioColor(l.estagioId) }}>
                          {estagioLabel(l.estagioId)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );

      case 'tarefas': {
        const hojeStr = new Date().toISOString().split('T')[0];

        // Filtragem conforme KPI selecionado
        let tarefasExibidas;
        if (filtroTarefas === 'atrasada') {
          tarefasExibidas = tarefas.filter((t) => t.status !== 'concluida' && t.dataVencimento && t.dataVencimento < hojeStr);
        } else if (filtroTarefas === 'hoje') {
          tarefasExibidas = tarefas.filter((t) => t.status !== 'concluida' && t.dataVencimento === hojeStr);
        } else if (filtroTarefas === 'abertas') {
          tarefasExibidas = tarefas.filter((t) => t.status !== 'concluida');
        } else if (filtroTarefas === 'concluidas') {
          tarefasExibidas = tarefas.filter((t) => t.status === 'concluida');
        } else {
          tarefasExibidas = proximasTarefas; // padrão: próximas 4
        }

        function toggleFiltro(f) { setFiltroTarefas((prev) => (prev === f ? null : f)); }

        return (
          <section className="dashboard__secao dashboard__card">
            <div className="dashboard__card-header">
              <button className="dash-tarefas__titulo-btn" onClick={() => onNavegar('tarefas')}>
                Resumo de Tarefas
              </button>
              <button className="dashboard__ver-todos" onClick={() => onNavegar('tarefas')}>Ver Tarefas →</button>
            </div>

            {/* KPIs clicáveis */}
            <div className="dash-tarefas__kpis">
              <button
                className={`dash-tarefas__kpi dash-tarefas__kpi--btn ${metricasTarefas.atrasadas > 0 ? 'dash-tarefas__kpi--perigo' : ''} ${filtroTarefas === 'atrasada' ? 'dash-tarefas__kpi--ativo' : ''}`}
                onClick={() => toggleFiltro('atrasada')}
              >
                <span className="dash-tarefas__kpi-valor">{metricasTarefas.atrasadas}</span>
                <span className="dash-tarefas__kpi-label">Atrasadas</span>
              </button>

              <button
                className={`dash-tarefas__kpi dash-tarefas__kpi--btn ${metricasTarefas.paraHoje > 0 ? 'dash-tarefas__kpi--alerta' : ''} ${filtroTarefas === 'hoje' ? 'dash-tarefas__kpi--ativo' : ''}`}
                onClick={() => toggleFiltro('hoje')}
              >
                <span className="dash-tarefas__kpi-valor">{metricasTarefas.paraHoje}</span>
                <span className="dash-tarefas__kpi-label">Para Hoje</span>
              </button>

              <button
                className={`dash-tarefas__kpi dash-tarefas__kpi--btn dash-tarefas__kpi--destaque ${filtroTarefas === 'abertas' ? 'dash-tarefas__kpi--ativo' : ''}`}
                onClick={() => toggleFiltro('abertas')}
              >
                <span className="dash-tarefas__kpi-valor">{metricasTarefas.abertas}</span>
                <span className="dash-tarefas__kpi-label">Em Aberto</span>
              </button>

              <button
                className={`dash-tarefas__kpi dash-tarefas__kpi--btn ${filtroTarefas === 'concluidas' ? 'dash-tarefas__kpi--ativo' : ''}`}
                onClick={() => toggleFiltro('concluidas')}
              >
                <span className="dash-tarefas__kpi-valor">{metricasTarefas.concluidas}</span>
                <span className="dash-tarefas__kpi-label">Concluídas</span>
              </button>
            </div>

            {/* Lista filtrada */}
            {tarefasExibidas.length > 0 ? (
              <div className="dash-tarefas__lista">
                {tarefasExibidas.map((t) => {
                  const sv = statusVenc(t.dataVencimento);
                  const concluida = t.status === 'concluida';
                  return (
                    <div key={t.id} className="dash-tarefa-linha" onClick={() => setTarefaSel(t)}>
                      <span className="dash-tarefa-linha__prio" style={{ background: PRIO_COR[t.prioridade] }} />
                      <span className={`dash-tarefa-linha__titulo ${concluida ? 'dash-tarefa-linha__titulo--concluida' : ''}`}>
                        {t.titulo}
                      </span>
                      {t.dataVencimento && !concluida && (
                        <span className={`dash-tarefa-linha__data ${sv === 'atrasada' ? 'dash-tarefa-linha__data--atrasada' : sv === 'hoje' ? 'dash-tarefa-linha__data--hoje' : ''}`}>
                          {sv === 'hoje' ? 'Hoje' : new Date(t.dataVencimento + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                      {concluida && <span className="dash-tarefa-linha__check">✓</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="dash-tarefas__vazio">
                {filtroTarefas ? 'Nenhuma tarefa nesta categoria.' : 'Nenhuma tarefa em aberto.'}
              </p>
            )}
          </section>
        );
      }

      case 'receita': {
        const recorrentesAprovados = leads.filter((l) =>
          l.estagioId === 'orcamento_aprovado' &&
          getTiposServico(l).some((t) => TIPOS_SERVICO[t]?.faturamento === 'recorrente')
        );
        const mrrAtual = recorrentesAprovados.reduce((s, l) => s + (l.valorEstimado ?? 0), 0);

        const enviados  = leads.filter((l) => l.estagioId === 'orcamento_enviado');
        const pendentes = leads.filter((l) => l.estagioId === 'orcamento_pendente');
        const totalEnviado  = enviados.reduce((s, l) => s + (l.valorEstimado ?? 0), 0);
        const totalPendente = pendentes.reduce((s, l) => s + (l.valorEstimado ?? 0), 0);

        const maxVal = Math.max(mrrAtual, totalEnviado, totalPendente, 1);

        const barras = [
          { label: 'Recorrência Atual', valor: mrrAtual,      cor: '#1A7A4A', sub: `${recorrentesAprovados.length} contratos ativos` },
          { label: 'Orç. Enviados',     valor: totalEnviado,  cor: '#3B82F6', sub: `${enviados.length} leads aguardando aprovação` },
          { label: 'Orç. Pendentes',    valor: totalPendente, cor: '#F59E0B', sub: `${pendentes.length} leads para elaborar` },
        ];

        const potencialTotal = mrrAtual + totalEnviado * 0.5 + totalPendente * 0.3;

        return (
          <section className="dashboard__secao dashboard__card">
            <div className="dashboard__card-header">
              <h2 className="dashboard__secao-titulo">Projeção de Receita</h2>
              <span className="dashboard__receita-meta">
                Previsão do mês: <strong>{fmt(potencialTotal)}</strong>
              </span>
            </div>

            <div className="dashboard__receita-barras">
              {barras.map((b) => (
                <div key={b.label} className="receita-barra">
                  <div className="receita-barra__header">
                    <span className="receita-barra__label">{b.label}</span>
                    <span className="receita-barra__valor">{fmt(b.valor)}</span>
                  </div>
                  <div className="receita-barra__track">
                    <div
                      className="receita-barra__fill"
                      style={{ width: `${Math.round((b.valor / maxVal) * 100)}%`, background: b.cor }}
                    />
                  </div>
                  <span className="receita-barra__sub">{b.sub}</span>
                </div>
              ))}
            </div>

            <div className="dashboard__receita-legenda">
              <span className="dashboard__receita-legenda-item">
                <span style={{ background: '#1A7A4A' }} />
                MRR confirmado
              </span>
              <span className="dashboard__receita-legenda-item">
                <span style={{ background: '#3B82F6' }} />
                50% de chance (enviados)
              </span>
              <span className="dashboard__receita-legenda-item">
                <span style={{ background: '#F59E0B' }} />
                30% de chance (pendentes)
              </span>
            </div>

            {(() => {
              const CATEGORIAS_META = [
                { id: 'carteira',          label: 'Contratos Recorrentes (Carteira)',
                  filtro: (l) => {
                    const tipos = getTiposServico(l);
                    return tipos.includes('locacao') ||
                      (tipos.includes('manutencao') && l.frequenciaVisita !== 'Pontual');
                  } },
                { id: 'manutencaoPontual', label: 'Manutenção Pontual',
                  filtro: (l) => getTiposServico(l).includes('manutencao') && l.frequenciaVisita === 'Pontual' },
                { id: 'vendas',            label: 'Vendas',
                  filtro: (l) => getTiposServico(l).includes('venda') },
                { id: 'reformas',          label: 'Reformas',
                  filtro: (l) => getTiposServico(l).includes('reforma') },
                { id: 'eventos',           label: 'Eventos',
                  filtro: (l) => getTiposServico(l).includes('locacao_evento') },
              ];
              const temMeta = CATEGORIAS_META.some((c) => Number(metas[c.id]) > 0);
              if (!temMeta) return null;
              return (
                <div className="dashboard__metas-wrap">
                  <h3 className="dashboard__metas-titulo">Metas do Mês</h3>
                  {CATEGORIAS_META.map((cat) => {
                    const meta = Number(metas[cat.id]) || 0;
                    if (!meta) return null;
                    const atual = leads
                      .filter((l) => l.estagioId === 'orcamento_aprovado' && cat.filtro(l))
                      .reduce((s, l) => s + (l.valorEstimado ?? 0), 0);
                    const pct = Math.min(Math.round((atual / meta) * 100), 100);
                    const cor = pct >= 100 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
                    return (
                      <div key={cat.id} className="dashboard__meta-item">
                        <div className="dashboard__meta-header">
                          <span className="dashboard__meta-label">{cat.label}</span>
                          <span className="dashboard__meta-valores">
                            <strong style={{ color: cor }}>{fmt(atual)}</strong>
                            <span className="dashboard__meta-sep"> / </span>
                            {fmt(meta)}
                            <span className="dashboard__meta-pct" style={{ color: cor }}>{pct}%</span>
                          </span>
                        </div>
                        <div className="dashboard__meta-track">
                          <div className="dashboard__meta-fill" style={{ width: `${pct}%`, background: cor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        );
      }

      default: return null;
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard__topbar">
        <div>
          <h1 className="dashboard__titulo">{saudacao()}</h1>
          <p className="dashboard__data">{HOJE_LABEL}</p>
        </div>
        {followUpsHoje.length > 0 && (
          <div className="dashboard__alerta-followup" onClick={() => onNavegar('kanban')}>
            <span className="dashboard__alerta-dot" />
            <span>
              <strong>{followUpsHoje.length}</strong> follow-up{followUpsHoje.length > 1 ? 's' : ''} para hoje
            </span>
            <span className="dashboard__alerta-cta">Ver Pipeline →</span>
          </div>
        )}
      </header>

      {/* ── Tabs Comercial / Operacional ── */}
      <div className="dashboard__tabs">
        <button
          className={`dashboard__tab ${aba === 'comercial' ? 'dashboard__tab--ativa' : ''}`}
          onClick={() => setAba('comercial')}
        >
          💼 Comercial
        </button>
        <button
          className={`dashboard__tab ${aba === 'operacional' ? 'dashboard__tab--ativa' : ''}`}
          onClick={() => setAba('operacional')}
        >
          🌿 Operacional
        </button>
      </div>

      <div className="dashboard__corpo">

        {aba === 'comercial' && (
          <>
            {/* ── KPIs — sempre no topo, não reordenável ── */}
            <section className="dashboard__secao">
              <h2 className="dashboard__secao-titulo">Visão Geral</h2>
              <div className="dashboard__kpis">
                <KpiCard label="Leads no Pipeline"   valor={animLeads}            sub="total de contatos" />
                <KpiCard label="Valor em Aberto"      valor={fmt(animPipeline)}    sub="orçamentos não fechados" onClick={() => onNavegar('kanban')} />
                <KpiCard label="Recorrência Mensal"   valor={fmt(animRecorrencia)} sub="contratos ativos/mês" destaque />
                <KpiCard label="Taxa de Conversão"    valor={`${animConversao}%`}  sub="aprovados vs finalizados" />
              </div>
            </section>

            {/* ── Seções reordenáveis ── */}
            {ordemSecoes.map((id) => {
              const content = renderSecaoContent(id);
              if (!content) return null;
              const isDragSrc  = dragSrc.current === id;
              const isDropTgt  = dragOver === id;
              return (
                <div
                  key={id}
                  className={`dashboard__bloco ${isDragSrc ? 'dashboard__bloco--arrastando' : ''} ${isDropTgt ? 'dashboard__bloco--drop' : ''}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, id)}
                  onDragOver={(e)  => onDragOver(e, id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e)      => onDrop(e, id)}
                  onDragEnd={onDragEnd}
                >
                  <DragHandle />
                  {content}
                </div>
              );
            })}
          </>
        )}

        {aba === 'operacional' && <DashboardOperacional onNavegar={onNavegar} />}

      </div>

      {/* ── Modal detalhe de tarefa ── */}
      {tarefaSelecionada && (
        <div className="tarefa-detalhe-overlay" onClick={(e) => e.target === e.currentTarget && setTarefaSel(null)}>
          <div className="tarefa-detalhe">
            <header className="tarefa-detalhe__header">
              <div className="tarefa-detalhe__header-info">
                <span className="tarefa-detalhe__prio-dot" style={{ background: PRIO_COR[tarefaSelecionada.prioridade] }} />
                <h3 className="tarefa-detalhe__titulo">{tarefaSelecionada.titulo}</h3>
              </div>
              <button className="tarefa-detalhe__fechar" onClick={() => setTarefaSel(null)}>✕</button>
            </header>

            <div className="tarefa-detalhe__corpo">
              <div className="tarefa-detalhe__meta">
                <div className="tarefa-detalhe__meta-item">
                  <span className="tarefa-detalhe__meta-label">Status</span>
                  <span className="tarefa-detalhe__meta-valor">{STATUS_LABEL[tarefaSelecionada.status] ?? tarefaSelecionada.status}</span>
                </div>
                <div className="tarefa-detalhe__meta-item">
                  <span className="tarefa-detalhe__meta-label">Prioridade</span>
                  <span className="tarefa-detalhe__meta-valor" style={{ color: PRIO_COR[tarefaSelecionada.prioridade] }}>
                    {PRIO_LABEL[tarefaSelecionada.prioridade]}
                  </span>
                </div>
                <div className="tarefa-detalhe__meta-item">
                  <span className="tarefa-detalhe__meta-label">Categoria</span>
                  <span className="tarefa-detalhe__meta-valor">{CAT_LABEL[tarefaSelecionada.categoria] ?? tarefaSelecionada.categoria}</span>
                </div>
                {tarefaSelecionada.dataVencimento && (
                  <div className="tarefa-detalhe__meta-item">
                    <span className="tarefa-detalhe__meta-label">Vencimento</span>
                    <span className={`tarefa-detalhe__meta-valor ${statusVenc(tarefaSelecionada.dataVencimento) === 'atrasada' ? 'tarefa-detalhe__meta-valor--perigo' : statusVenc(tarefaSelecionada.dataVencimento) === 'hoje' ? 'tarefa-detalhe__meta-valor--alerta' : ''}`}>
                      {statusVenc(tarefaSelecionada.dataVencimento) === 'hoje'
                        ? 'Hoje'
                        : new Date(tarefaSelecionada.dataVencimento + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {tarefaSelecionada.leadId && leadNome(tarefaSelecionada.leadId) && (
                  <div className="tarefa-detalhe__meta-item">
                    <span className="tarefa-detalhe__meta-label">Lead relacionado</span>
                    <span className="tarefa-detalhe__meta-valor">{leadNome(tarefaSelecionada.leadId)}</span>
                  </div>
                )}
              </div>

              {tarefaSelecionada.descricao && (
                <div className="tarefa-detalhe__descricao">
                  <span className="tarefa-detalhe__meta-label">Descrição</span>
                  <p className="tarefa-detalhe__descricao-texto">{tarefaSelecionada.descricao}</p>
                </div>
              )}
            </div>

            <footer className="tarefa-detalhe__footer">
              <button className="tarefa-detalhe__btn-fechar" onClick={() => setTarefaSel(null)}>Fechar</button>
              <button className="tarefa-detalhe__btn-ir" onClick={() => { setTarefaSel(null); onNavegar('tarefas'); }}>
                Abrir em Tarefas →
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Modal de Follow-ups Arquivados ── */}
      {arquivadosAberto && (
        <div className="fu-arquivo-overlay" onClick={(e) => e.target === e.currentTarget && setArquivadosAberto(false)}>
          <div className="fu-arquivo-modal">
            <header className="fu-arquivo-header">
              <div>
                <h2 className="fu-arquivo-titulo">📁 Follow-ups Arquivados</h2>
                <p className="fu-arquivo-sub">{totalArquivados} registro{totalArquivados !== 1 ? 's' : ''} · arquivados automaticamente após 30 dias</p>
              </div>
              <button className="fu-arquivo-fechar" onClick={() => setArquivadosAberto(false)}>✕</button>
            </header>

            <div className="fu-arquivo-corpo">
              {followUpsArquivados.length === 0 ? (
                <p className="fu-arquivo-vazio">Nenhum follow-up arquivado ainda.</p>
              ) : followUpsArquivados.map(({ mes, itens }) => (
                <div key={mes} className="fu-arquivo-secao">
                  <h3 className="fu-arquivo-mes">{mesLabel(mes)}</h3>
                  {itens.map((arq, i) => {
                    const dataFmt = new Date(arq.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
                    return (
                      <div key={i} className="fu-arquivo-item">
                        <div className="fu-arquivo-item__info">
                          <p className="fu-arquivo-item__empresa">{arq.empresa}</p>
                          <p className="fu-arquivo-item__contato">{arq.contato}{arq.bairro ? ` · ${arq.bairro}` : ''}</p>
                          {arq.assuntos?.length > 0 && (
                            <div className="followup-item__assuntos">
                              {arq.assuntos.map((id) => {
                                const a = FU_ASSUNTO_LABEL[id];
                                return a ? <span key={id} className="followup-item__assunto-pill followup-item__assunto-pill--neutro">{a.icone} {a.label}</span> : null;
                              })}
                            </div>
                          )}
                          {arq.nota && <p className="followup-item__nota">"{arq.nota}"</p>}
                        </div>
                        <div className="fu-arquivo-item__meta">
                          <span className="followup-item__data-pill">{dataFmt}</span>
                          <span className="fu-arquivo-item__arquivado-em">
                            arquivado em {new Date(arq.arquivadoEm + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dashboard — Aba Operacional (agenda, campo, clientes, visitas)
// ─────────────────────────────────────────────────────────────────────────────
function DashboardOperacional({ onNavegar }) {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({
    agendaHoje: [],
    agendaSemana: [],
    relatoriosSemana: [],
    ultimosRelatorios: [],
    clientes: [],
    employees: [],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const hoje = new Date().toISOString().split('T')[0];
      const daquiSete = new Date();
      daquiSete.setDate(daquiSete.getDate() + 7);
      const daquiSeteStr = daquiSete.toISOString().split('T')[0];
      const setePassados = new Date();
      setePassados.setDate(setePassados.getDate() - 7);
      const setePassadosIso = setePassados.toISOString();

      const [ag, agSem, relSem, ultimosRel, cli, emp] = await Promise.all([
        supabase.from('agenda').select(`
          id, data_agendada, hora_estimada_chegada, funcionario_id, status, tipos_tarefa,
          cliente:clientes(id, nome_empresa, bairro)
        `).eq('data_agendada', hoje).order('ordem_rota'),
        supabase.from('agenda').select(`
          id, data_agendada, funcionario_id, status, tipos_tarefa,
          cliente:clientes(id, nome_empresa)
        `).gte('data_agendada', hoje).lte('data_agendada', daquiSeteStr),
        supabase.from('relatorios').select('id, funcionario_id, checkin_at, checkout_at, agendamento_id').gte('checkin_at', setePassadosIso),
        supabase.from('relatorios').select(`
          id, funcionario_id, checkin_at,
          agenda:agenda(cliente:clientes(nome_empresa, bairro))
        `).order('checkin_at', { ascending: false }).limit(6),
        supabase.from('clientes').select('id, nome_empresa, grupo_servico, frequencia_visitas, ativo').eq('ativo', true),
        supabase.from('employees').select('id, name, cargo').in('cargo', ['Campo', 'Facilities', 'TI']).order('name'),
      ]);

      setDados({
        agendaHoje:        ag.data ?? [],
        agendaSemana:      agSem.data ?? [],
        relatoriosSemana:  relSem.data ?? [],
        ultimosRelatorios: ultimosRel.data ?? [],
        clientes:          cli.data ?? [],
        employees:         emp.data ?? [],
      });
      setLoading(false);
    })();
  }, []);

  const empMap = useMemo(() => new Map((dados.employees ?? []).map(e => [String(e.id), e.name])), [dados.employees]);

  const kpis = useMemo(() => {
    const visitasHoje = dados.agendaHoje.length;
    const publicadasHoje = dados.agendaHoje.filter(v => v.status === 'publicado' || v.status === 'em_execucao' || v.status === 'concluido').length;
    const concluidasHoje = dados.agendaHoje.filter(v => v.status === 'concluido').length;
    const funcAtivosHoje = new Set(dados.agendaHoje.filter(v => v.funcionario_id).map(v => String(v.funcionario_id))).size;
    const visitasSemana = dados.agendaSemana.length;
    const trocasSemana = dados.agendaSemana.filter(v => (v.tipos_tarefa ?? []).includes('troca')).length;
    return {
      visitasHoje, publicadasHoje, concluidasHoje, funcAtivosHoje, visitasSemana, trocasSemana,
      clientesAtivos: dados.clientes.length,
      relatoriosSemana: dados.relatoriosSemana.length,
    };
  }, [dados]);

  const freqMap = useMemo(() => {
    const map = { Semanal: 0, Quinzenal: 0, Mensal: 0, Outro: 0 };
    dados.clientes.forEach(c => {
      const f = c.frequencia_visitas;
      if (f === 'semanal') map.Semanal++;
      else if (f === 'quinzenal') map.Quinzenal++;
      else if (f === 'mensal') map.Mensal++;
      else map.Outro++;
    });
    return map;
  }, [dados.clientes]);

  const grupoMap = useMemo(() => {
    const map = {};
    dados.clientes.forEach(c => {
      const g = c.grupo_servico ?? 'Sem grupo';
      map[g] = (map[g] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [dados.clientes]);

  if (loading) {
    return (
      <div className="dashboard-op__loading">
        <div className="dashboard-op__spinner" />
        <p>Carregando dados operacionais...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-op">
      {/* KPIs operacionais */}
      <section className="dashboard__secao">
        <h2 className="dashboard__secao-titulo">Visão Geral — Campo</h2>
        <div className="dashboard__kpis">
          <KpiCard label="Visitas Hoje" valor={kpis.visitasHoje} sub={`${kpis.concluidasHoje} concluída${kpis.concluidasHoje !== 1 ? 's' : ''}`} onClick={() => onNavegar('escala')} />
          <KpiCard label="Funcionários em campo" valor={kpis.funcAtivosHoje} sub="com visitas hoje" />
          <KpiCard label="Clientes ativos" valor={kpis.clientesAtivos} sub="base atual" onClick={() => onNavegar('clientes')} destaque />
          <KpiCard label="Trocas na semana" valor={kpis.trocasSemana} sub={`de ${kpis.visitasSemana} visitas`} />
        </div>
      </section>

      <div className="dashboard-op__grid">

        {/* Agenda de hoje */}
        <section className="dashboard__secao dashboard__card">
          <div className="dashboard__card-header">
            <h2 className="dashboard__secao-titulo">Agenda de hoje</h2>
            <button className="dashboard__ver-todos" onClick={() => onNavegar('escala')}>Ver Escala →</button>
          </div>
          {dados.agendaHoje.length === 0 ? (
            <p className="dashboard-op__vazio">Nenhuma visita agendada para hoje.</p>
          ) : (
            <div className="dashboard-op__agenda-lista">
              {dados.agendaHoje.slice(0, 8).map((v) => {
                const stCor = v.status === 'concluido' ? '#10B981' : v.status === 'em_execucao' ? '#3B82F6' : v.status === 'publicado' ? '#F59E0B' : '#9CA3AF';
                return (
                  <div key={v.id} className="dashboard-op__agenda-item">
                    <span className="dashboard-op__agenda-hora">{v.hora_estimada_chegada?.slice(0, 5) ?? '—'}</span>
                    <div className="dashboard-op__agenda-mid">
                      <div className="dashboard-op__agenda-cli">{v.cliente?.nome_empresa ?? '—'}</div>
                      <div className="dashboard-op__agenda-func">👤 {empMap.get(String(v.funcionario_id)) ?? '—'} · 📍 {v.cliente?.bairro ?? '—'}</div>
                    </div>
                    <span className="dashboard-op__agenda-status" style={{ background: stCor }}>{v.status ?? 'rascunho'}</span>
                  </div>
                );
              })}
              {dados.agendaHoje.length > 8 && (
                <p className="dashboard-op__mais">+ {dados.agendaHoje.length - 8} visita{dados.agendaHoje.length - 8 !== 1 ? 's' : ''}</p>
              )}
            </div>
          )}
        </section>

        {/* Frequência de manutenção */}
        <section className="dashboard__secao dashboard__card">
          <h2 className="dashboard__secao-titulo">Frequência de manutenção</h2>
          <div className="dashboard__servicos">
            {Object.entries(freqMap).map(([f, n]) => {
              const pct = kpis.clientesAtivos > 0 ? Math.round((n / kpis.clientesAtivos) * 100) : 0;
              return (
                <div key={f} className="servico-barra">
                  <div className="servico-barra__header">
                    <span className="servico-barra__nome">{f}</span>
                    <span className="servico-barra__pct">{n} · {pct}%</span>
                  </div>
                  <div className="servico-barra__track">
                    <div className="servico-barra__fill" style={{ width: `${pct}%`, background: f === 'Semanal' ? '#3B82F6' : f === 'Quinzenal' ? '#8B5CF6' : f === 'Mensal' ? '#10B981' : '#9CA3AF' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="dashboard-op__grid">
        {/* Últimas visitas concluídas */}
        <section className="dashboard__secao dashboard__card">
          <div className="dashboard__card-header">
            <h2 className="dashboard__secao-titulo">Últimas visitas concluídas</h2>
            <button className="dashboard__ver-todos" onClick={() => onNavegar('relatorios')}>Ver Relatórios →</button>
          </div>
          {dados.ultimosRelatorios.length === 0 ? (
            <p className="dashboard-op__vazio">Nenhum relatório na base.</p>
          ) : (
            <div className="dashboard-op__ult-lista">
              {dados.ultimosRelatorios.map((r) => {
                const cli = r.agenda?.cliente;
                const quando = r.checkin_at ? new Date(r.checkin_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
                return (
                  <div key={r.id} className="dashboard-op__ult-item">
                    <div className="dashboard-op__ult-info">
                      <div className="dashboard-op__ult-empresa">{cli?.nome_empresa ?? '—'}</div>
                      <div className="dashboard-op__ult-meta">👤 {empMap.get(String(r.funcionario_id)) ?? '—'} · 📍 {cli?.bairro ?? '—'}</div>
                    </div>
                    <span className="dashboard-op__ult-data">{quando}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Grupos de clientes */}
        <section className="dashboard__secao dashboard__card">
          <h2 className="dashboard__secao-titulo">Clientes por grupo</h2>
          {grupoMap.length === 0 ? (
            <p className="dashboard-op__vazio">Nenhum cliente ativo.</p>
          ) : (
            <div className="dashboard__servicos">
              {grupoMap.map(([g, n]) => {
                const pct = Math.round((n / kpis.clientesAtivos) * 100);
                return (
                  <div key={g} className="servico-barra">
                    <div className="servico-barra__header">
                      <span className="servico-barra__nome">{g}</span>
                      <span className="servico-barra__pct">{n} · {pct}%</span>
                    </div>
                    <div className="servico-barra__track">
                      <div className="servico-barra__fill" style={{ width: `${pct}%`, background: '#1A7A4A' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

    </div>
  );
}
