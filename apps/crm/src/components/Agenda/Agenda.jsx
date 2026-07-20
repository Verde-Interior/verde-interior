// src/components/Agenda/Agenda.jsx
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useCRM } from '../../context/CRMContext';
import {
  getEventosPorData, TIPO_COR, TIPO_LABEL, TIPO_ICONE,
  MESES_PT, DIAS_SEMANA_CURTO, addMes, buildGrid,
  formatarDataLonga,
} from '../../utils/calendarioUtils';
import AddLeadModal from '../AddLeadModal/AddLeadModal';
import './Agenda.css';

const CATEGORIAS = {
  geral:          { label: 'Geral',          emoji: '📌' },
  visita:         { label: 'Visita',         emoji: '🗺️' },
  orcamento:      { label: 'Orçamento',      emoji: '📄' },
  followup:       { label: 'Follow-up',      emoji: '📞' },
  administrativo: { label: 'Administrativo', emoji: '🗂️' },
};

const FORM_VAZIO = { titulo: '', categoria: 'geral', leadId: '', prioridade: 'media' };

export default function Agenda() {
  const { leads, tarefas, adicionarTarefa, abrirModal } = useCRM();
  const hoje = new Date();
  const hojeIso = hoje.toISOString().split('T')[0];

  const [nav, setNav]             = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaSel, setDiaSel]       = useState(hojeIso);
  const [modoNovo, setModoNovo]   = useState(null);
  const [form, setForm]           = useState(FORM_VAZIO);
  const [addLeadAberto, setAddLead] = useState(false);
  const [tarefaExpandida, setTarefaExp] = useState(null); // id da tarefa expandida
  const [painelW, setPainelW]   = useState(300);
  const resizing = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(0);

  const onMouseMove = useCallback((e) => {
    if (!resizing.current) return;
    const delta = startX.current - e.clientX;
    setPainelW(Math.min(520, Math.max(200, startW.current + delta)));
  }, []);

  const onMouseUp = useCallback(() => {
    resizing.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onMouseMove]);

  function onMouseDownHandle(e) {
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = painelW;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  useEffect(() => () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove, onMouseUp]);

  const eventosPorData = useMemo(() => getEventosPorData(leads), [leads]);

  const tarefasPorData = useMemo(() => {
    const mapa = {};
    tarefas.forEach((t) => {
      if (t.dataVencimento && t.status !== 'concluida') {
        if (!mapa[t.dataVencimento]) mapa[t.dataVencimento] = [];
        mapa[t.dataVencimento].push(t);
      }
    });
    return mapa;
  }, [tarefas]);

  const { ano, mes } = nav;
  const grid = buildGrid(ano, mes);

  function selDia(iso) {
    setDiaSel(iso);
    setModoNovo(null);
    setForm(FORM_VAZIO);
  }

  function irHoje() {
    const h = new Date();
    setNav({ ano: h.getFullYear(), mes: h.getMonth() });
    setDiaSel(hojeIso);
  }

  function abrirLeadEvento(leadId) {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) abrirModal(lead);
  }

  function salvarTarefa() {
    if (!form.titulo.trim()) return;
    adicionarTarefa({
      titulo: form.titulo.trim(),
      categoria: form.categoria,
      dataVencimento: diaSel,
      leadId: form.leadId || null,
      prioridade: form.prioridade,
      status: 'a_fazer',
      descricao: '',
    });
    setForm(FORM_VAZIO);
    setModoNovo(null);
  }

  const eventosDia  = diaSel ? (eventosPorData[diaSel]  ?? []) : [];
  const tarefasDia  = diaSel ? (tarefasPorData[diaSel]  ?? []) : [];
  const temConteudo = eventosDia.length > 0 || tarefasDia.length > 0;

  return (
    <div className="agenda">
      {/* ── Header ── */}
      <header className="agenda__header">
        <div className="agenda__header-esq">
          <h1 className="agenda__titulo">Agenda</h1>
          <p className="agenda__subtitulo">Visitas, prazos e tarefas do time</p>
        </div>
        <div className="agenda__header-dir">
          <div className="agenda__nav-mes">
            <button className="agenda__nav-btn" onClick={() => setNav(addMes(ano, mes, -1))}>‹</button>
            <span className="agenda__mes-label">{MESES_PT[mes]} {ano}</span>
            <button className="agenda__nav-btn" onClick={() => setNav(addMes(ano, mes, 1))}>›</button>
          </div>
          <button className="agenda__btn-hoje" onClick={irHoje}>Hoje</button>
        </div>
      </header>

      {/* ── Corpo: calendário + painel ── */}
      <div className="agenda__corpo">

        {/* Calendário */}
        <div className="agenda__cal">
          {/* Dias da semana */}
          <div className="agenda__dias-semana">
            {DIAS_SEMANA_CURTO.map((d) => (
              <div key={d} className="agenda__wd">{d}</div>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="agenda__grade">
            {grid.map((iso, i) => {
              if (!iso) return <div key={i} className="agenda__celula agenda__celula--vazia" />;
              const evs    = eventosPorData[iso]  ?? [];
              const tafs   = tarefasPorData[iso]  ?? [];
              const total  = evs.length + tafs.length;
              const isHoje = iso === hojeIso;
              const isSel  = iso === diaSel;
              const dia    = parseInt(iso.split('-')[2], 10);

              return (
                <div
                  key={i}
                  className={`agenda__celula ${isHoje ? 'agenda__celula--hoje' : ''} ${isSel ? 'agenda__celula--selecionado' : ''} ${total > 0 ? 'agenda__celula--com-ev' : ''}`}
                  onClick={() => selDia(iso)}
                >
                  <span className="agenda__dia-num">{dia}</span>

                  {/* Pills de eventos (máx 3 visíveis) */}
                  <div className="agenda__pills">
                    {evs.slice(0, 2).map((ev, j) => (
                      <div
                        key={`ev-${j}`}
                        className="agenda__pill"
                        style={{ '--pill-cor': TIPO_COR[ev.tipo] }}
                        onClick={(e) => { e.stopPropagation(); abrirLeadEvento(ev.leadId); }}
                        title={`${ev.leadNome} · ${ev.label}`}
                      >
                        <span className="agenda__pill-icone">{TIPO_ICONE[ev.tipo]}</span>
                        <span className="agenda__pill-texto">{ev.leadNome}</span>
                      </div>
                    ))}
                    {tafs.slice(0, evs.length >= 2 ? 0 : 2 - evs.length).map((t, j) => (
                      <div
                        key={`tf-${j}`}
                        className="agenda__pill"
                        style={{ '--pill-cor': TIPO_COR.tarefa }}
                        title={t.titulo}
                      >
                        <span className="agenda__pill-icone">✅</span>
                        <span className="agenda__pill-texto">{t.titulo}</span>
                      </div>
                    ))}
                    {total > 2 && (
                      <div className="agenda__pill-mais">+{total - 2} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Painel lateral do dia ── */}
        <aside className="agenda__painel" style={{ width: painelW }}>
          {/* Handle de redimensionamento */}
          <div className="agenda__painel-handle" onMouseDown={onMouseDownHandle} />
          {!diaSel ? (
            <div className="agenda__painel-vazio">
              <span className="agenda__painel-vazio-icone">📅</span>
              <p>Clique em um dia para ver seus eventos</p>
            </div>
          ) : (
            <>
              {/* Título do dia */}
              <div className="agenda__painel-head">
                <h2 className="agenda__painel-data">{formatarDataLonga(diaSel)}</h2>
                {diaSel === hojeIso && <span className="agenda__painel-hoje-tag">Hoje</span>}
              </div>

              {/* Eventos do fluxo de orçamento */}
              {eventosDia.length > 0 && (
                <section className="agenda__painel-secao">
                  <h3 className="agenda__painel-secao-titulo">Eventos</h3>
                  {eventosDia.map((ev, i) => (
                    <button
                      key={i}
                      className="agenda__painel-evento"
                      onClick={() => abrirLeadEvento(ev.leadId)}
                    >
                      <span
                        className="agenda__painel-evento-barra"
                        style={{ background: TIPO_COR[ev.tipo] }}
                      />
                      <div className="agenda__painel-evento-info">
                        <span className="agenda__painel-evento-tipo">
                          {TIPO_ICONE[ev.tipo]} {TIPO_LABEL[ev.tipo]}
                        </span>
                        <span className="agenda__painel-evento-nome">{ev.leadNome}</span>
                        <span className="agenda__painel-evento-detalhe">{ev.label}</span>
                      </div>
                      <span className="agenda__painel-evento-abrir">Abrir →</span>
                    </button>
                  ))}
                </section>
              )}

              {/* Tarefas do dia — interativas como eventos */}
              {tarefasDia.length > 0 && (
                <section className="agenda__painel-secao">
                  <h3 className="agenda__painel-secao-titulo">Tarefas & Follow-ups</h3>
                  {tarefasDia.map((t) => {
                    const cat    = CATEGORIAS[t.categoria];
                    const isExp  = tarefaExpandida === t.id;
                    const corPri = t.prioridade === 'alta' ? '#EF4444' : t.prioridade === 'media' ? '#F59E0B' : '#10B981';
                    const leadNome = t.leadId ? leads.find((l) => l.id === t.leadId)?.empresa : null;
                    return (
                      <div key={t.id} className={`agenda__painel-evento agenda__painel-tarefa-card ${isExp ? 'agenda__painel-tarefa-card--exp' : ''}`}>
                        <span className="agenda__painel-evento-barra" style={{ background: corPri }} />
                        <div className="agenda__painel-evento-info" style={{ flex: 1 }}>
                          <span className="agenda__painel-evento-tipo">
                            {cat?.emoji ?? '📌'} {cat?.label ?? 'Tarefa'}
                          </span>
                          <span className="agenda__painel-evento-nome">{t.titulo}</span>
                          {leadNome && <span className="agenda__painel-evento-detalhe">{leadNome}</span>}
                          {isExp && t.descricao && (
                            <span className="agenda__painel-tarefa-desc">{t.descricao}</span>
                          )}
                        </div>
                        <button
                          className="agenda__painel-evento-abrir"
                          onClick={() => setTarefaExp(isExp ? null : t.id)}
                        >
                          {isExp ? '▲' : '▼'}
                        </button>
                      </div>
                    );
                  })}
                </section>
              )}

              {/* Sem conteúdo */}
              {!temConteudo && modoNovo === null && (
                <p className="agenda__painel-sem-ev">Nenhum evento ou tarefa neste dia.</p>
              )}

              {/* Form nova tarefa / follow-up */}
              {(modoNovo === 'tarefa' || modoNovo === 'followup') && (
                <section className="agenda__painel-secao">
                  <h3 className="agenda__painel-secao-titulo">
                    {modoNovo === 'followup' ? '📞 Novo Follow-up' : '✅ Nova Tarefa'}
                  </h3>
                  <div className="agenda__form">
                    <input
                      className="agenda__form-input"
                      placeholder={modoNovo === 'followup' ? 'Ex: Retornar contato com cliente...' : 'Título da tarefa*'}
                      value={form.titulo}
                      onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                      autoFocus
                    />
                    {modoNovo === 'tarefa' && (
                      <select
                        className="agenda__form-select"
                        value={form.categoria}
                        onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                      >
                        {Object.entries(CATEGORIAS).map(([k, v]) => (
                          <option key={k} value={k}>{v.emoji} {v.label}</option>
                        ))}
                      </select>
                    )}
                    <select
                      className="agenda__form-select"
                      value={form.prioridade}
                      onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                    >
                      <option value="alta">🔴 Alta prioridade</option>
                      <option value="media">🟡 Média prioridade</option>
                      <option value="baixa">🟢 Baixa prioridade</option>
                    </select>
                    <select
                      className="agenda__form-select"
                      value={form.leadId}
                      onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))}
                    >
                      <option value="">Sem lead associado</option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>{l.empresa}</option>
                      ))}
                    </select>
                    <div className="agenda__form-btns">
                      <button
                        className="agenda__form-salvar"
                        onClick={() => {
                          salvarTarefa();
                          if (modoNovo === 'followup') {
                            setForm((f) => ({ ...f, categoria: 'geral' }));
                          }
                        }}
                      >
                        {modoNovo === 'followup' ? 'Salvar Follow-up' : 'Salvar Tarefa'}
                      </button>
                      <button className="agenda__form-cancelar" onClick={() => { setModoNovo(null); setForm(FORM_VAZIO); }}>Cancelar</button>
                    </div>
                  </div>
                </section>
              )}

              {/* Botões de ação */}
              {modoNovo === null && (
                <div className="agenda__painel-acoes">
                  <button className="agenda__painel-acao" onClick={() => setModoNovo('tarefa')}>
                    ✅ Nova Tarefa
                  </button>
                  <button className="agenda__painel-acao agenda__painel-acao--followup" onClick={() => { setModoNovo('followup'); setForm((f) => ({ ...f, categoria: 'followup' })); }}>
                    📞 Novo Follow-up
                  </button>
                  <button
                    className="agenda__painel-acao agenda__painel-acao--lead"
                    onClick={() => setAddLead(true)}
                  >
                    🌿 Novo Lead
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <AddLeadModal aberto={addLeadAberto} onFechar={() => setAddLead(false)} />
    </div>
  );
}
