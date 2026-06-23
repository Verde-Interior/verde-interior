// src/components/SidebarCalendario/SidebarCalendario.jsx
import { useMemo, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import {
  getEventosPorData, TIPO_COR, TIPO_ICONE,
  MESES_PT, addMes, buildGrid,
  formatarDataCurta, formatarDataLonga,
} from '../../utils/calendarioUtils';
import AddLeadModal from '../AddLeadModal/AddLeadModal';
import './SidebarCalendario.css';

const DIAS_SEMANA = ['D','S','T','Q','Q','S','S'];

export default function SidebarCalendario() {
  const { leads, abrirModal, adicionarTarefa } = useCRM();
  const hoje = new Date();
  const hojeIso = hoje.toISOString().split('T')[0];

  const [nav, setNav] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [diaAberto, setDiaAberto]       = useState(null);
  const [modoNovo, setModoNovo]         = useState(null);
  const [tituloTarefa, setTituloTarefa] = useState('');
  const [addLeadAberto, setAddLead]     = useState(false);

  const eventosPorData = useMemo(() => getEventosPorData(leads), [leads]);

  // ── Grade do mês ──────────────────────────────────────────────────────────
  const { ano, mes } = nav;
  const grid = buildGrid(ano, mes);

  // ── Próximos 7 dias ───────────────────────────────────────────────────────
  const proximos = useMemo(() => {
    const resultado = [];
    for (let d = 0; d <= 7; d++) {
      const dt = new Date(hoje);
      dt.setDate(dt.getDate() + d);
      const iso = dt.toISOString().split('T')[0];
      (eventosPorData[iso] ?? []).forEach((ev) => resultado.push({ iso, ...ev }));
    }
    return resultado.slice(0, 6);
  }, [eventosPorData, hojeIso]);

  function toggleDia(iso) {
    setDiaAberto(diaAberto === iso ? null : iso);
    setModoNovo(null);
    setTituloTarefa('');
  }

  function abrirLead(leadId) {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) abrirModal(lead);
    setDiaAberto(null);
  }

  function salvarTarefa() {
    if (!tituloTarefa.trim() || !diaAberto) return;
    adicionarTarefa({ titulo: tituloTarefa.trim(), dataVencimento: diaAberto, categoria: 'geral', prioridade: 'media', status: 'a_fazer', descricao: '', leadId: null });
    setTituloTarefa('');
    setModoNovo(null);
    setDiaAberto(null);
  }

  return (
    <div className="sidebar-cal">
      {/* Cabeçalho do mês */}
      <div className="sidebar-cal__head">
        <button className="sidebar-cal__nav-btn" onClick={() => setNav(addMes(ano, mes, -1))}>‹</button>
        <span className="sidebar-cal__mes-label">{MESES_PT[mes].slice(0, 3)} {ano}</span>
        <button className="sidebar-cal__nav-btn" onClick={() => setNav(addMes(ano, mes, 1))}>›</button>
      </div>

      {/* Grade */}
      <div className="sidebar-cal__grid">
        {DIAS_SEMANA.map((d, i) => <span key={i} className="sidebar-cal__wd">{d}</span>)}
        {grid.map((iso, i) => {
          if (!iso) return <span key={i} className="sidebar-cal__celula sidebar-cal__celula--vazia" />;
          const evs = eventosPorData[iso] ?? [];
          const tipos = [...new Set(evs.map((e) => e.tipo))];
          const isHoje = iso === hojeIso;
          const isAberto = diaAberto === iso;
          const dia = parseInt(iso.split('-')[2], 10);
          return (
            <button
              key={i}
              className={`sidebar-cal__celula sidebar-cal__celula--btn ${isHoje ? 'sidebar-cal__celula--hoje' : ''} ${evs.length > 0 ? 'sidebar-cal__celula--evento' : ''} ${isAberto ? 'sidebar-cal__celula--ativo' : ''}`}
              onClick={() => toggleDia(iso)}
              title={evs.length > 0 ? evs.map((e) => `${e.leadNome}: ${e.label}`).join('\n') : formatarDataCurta(iso)}
            >
              {dia}
              {tipos.length > 0 && (
                <span className="sidebar-cal__dots">
                  {tipos.slice(0, 3).map((t, ti) => (
                    <span key={ti} className="sidebar-cal__dot" style={{ background: TIPO_COR[t] }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Popover do dia selecionado */}
      {diaAberto && (
        <div className="sidebar-cal__popover">
          <div className="sidebar-cal__pop-titulo">
            {parseInt(diaAberto.split('-')[2], 10)} de {MESES_PT[parseInt(diaAberto.split('-')[1], 10) - 1]}
          </div>

          {/* Eventos do dia */}
          {(eventosPorData[diaAberto] ?? []).length === 0 && modoNovo === null && (
            <p className="sidebar-cal__pop-vazio">Nenhum evento neste dia</p>
          )}
          {(eventosPorData[diaAberto] ?? []).map((ev, i) => (
            <button key={i} className="sidebar-cal__pop-ev" onClick={() => abrirLead(ev.leadId)}>
              <span className="sidebar-cal__pop-ev-icone">{TIPO_ICONE[ev.tipo]}</span>
              <div className="sidebar-cal__pop-ev-info">
                <span className="sidebar-cal__pop-ev-nome">{ev.leadNome}</span>
                <span className="sidebar-cal__pop-ev-label">{ev.label}</span>
              </div>
              <span className="sidebar-cal__pop-ev-seta">→</span>
            </button>
          ))}

          {/* Form rápido de tarefa */}
          {modoNovo === 'tarefa' && (
            <div className="sidebar-cal__pop-form">
              <input
                className="sidebar-cal__pop-input"
                placeholder="Título da tarefa..."
                value={tituloTarefa}
                onChange={(e) => setTituloTarefa(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && salvarTarefa()}
                autoFocus
              />
              <div className="sidebar-cal__pop-form-btns">
                <button className="sidebar-cal__pop-salvar" onClick={salvarTarefa}>Salvar</button>
                <button className="sidebar-cal__pop-cancelar" onClick={() => setModoNovo(null)}>✕</button>
              </div>
            </div>
          )}

          {/* Ações rápidas */}
          {modoNovo === null && (
            <div className="sidebar-cal__pop-acoes">
              <button className="sidebar-cal__pop-acao" onClick={() => { setAddLead(true); setDiaAberto(null); }}>
                + Novo Lead
              </button>
              <button className="sidebar-cal__pop-acao" onClick={() => setModoNovo('tarefa')}>
                + Nova Tarefa
              </button>
            </div>
          )}
        </div>
      )}

      {/* Próximos eventos */}
      {proximos.length > 0 && !diaAberto && (
        <div className="sidebar-cal__proximos">
          <span className="sidebar-cal__proximos-titulo">Próximos eventos</span>
          {proximos.map((ev, i) => (
            <button key={i} className="sidebar-cal__evento" onClick={() => abrirLead(ev.leadId)}>
              <span className="sidebar-cal__evento-dot" style={{ background: TIPO_COR[ev.tipo] }} />
              <div className="sidebar-cal__evento-info">
                <span className="sidebar-cal__evento-data">{formatarDataCurta(ev.iso)}</span>
                <span className="sidebar-cal__evento-label">{ev.leadNome} · {ev.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {proximos.length === 0 && !diaAberto && (
        <p className="sidebar-cal__vazio">Sem eventos nos próximos 7 dias</p>
      )}
    <AddLeadModal aberto={addLeadAberto} onFechar={() => setAddLead(false)} />
    </div>
  );
}
