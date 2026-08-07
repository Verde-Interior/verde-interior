// src/components/EscalaCampo/EscalaCalendario.jsx
// Visão de calendário (quinzenal/mês) da Escala — complementa a visão de
// Semana (colunas por funcionário), que continua sendo a padrão pro dia a
// dia. Estrutura inspirada num sistema de referência que o usuário mostrou:
// cada célula lista as visitas do dia (hora + cliente), hover mostra um
// balão com detalhes rápidos, clique abre o card completo da visita (com
// mapa discreto). "mais +N" e o número do dia abrem o dia inteiro num modal.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { buildGrid, MESES_PT, DIAS_SEMANA_CURTO, formatarDataLonga } from '../../utils/calendarioUtils';
import { getSemana as getSemanaUtil, addDias, formatarDataCurta } from '../../utils/dateUtils';
import { STATUS_VISITA_COR, labelStatusVisita } from '../../utils/escalaHelpers';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import CardDetalheVisitaCalendario from './CardDetalheVisitaCalendario';
import './EscalaCalendario.css';

const DIAS_SEMANA_SEG = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MAX_LINHAS_CELULA = 4;

// Quinzena = 2 semanas consecutivas (Seg–Dom, mesma semântica da visão de
// Semana) — reaproveita getSemana em vez de reinventar o alinhamento de dias.
function buildGridQuinzena(baseIso) {
  return [...getSemanaUtil(baseIso), ...getSemanaUtil(addDias(baseIso, 7))];
}

export default function EscalaCalendario({
  modo, // 'quinzenal' | 'mes'
  visitasPorDia, // Map<iso, Array<{ id, hora, cliente, endereco, lat, lng, funcionario, status, duracao, observacoes, tiposTarefa, prioridade, dataAgendada }>>
  loading,
  calAno, calMes, onNavMes,
  quinzenaBase, onNavQuinzena,
  hojeIso,
  onAbrirDia,
  onSelecionarDia,
  onAdicionarTarefa,
  onReagendar,
  onEditarVisita,
  onVerRelatorioVisita,
}) {
  const [diaAberto, setDiaAberto] = useState(null); // iso do dia (modal "ver tudo")
  const [visitaAberta, setVisitaAberta] = useState(null); // visita clicada (card de detalhe)
  const [tooltip, setTooltip] = useState(null); // { x, y, visita }
  const [dragVisitaId, setDragVisitaId] = useState(null); // id da visita sendo arrastada
  const [dragOverIso, setDragOverIso] = useState(null); // dia com hover durante o arraste
  const overlayClose = useOverlayClose(() => setDiaAberto(null));

  function soltarEm(iso) {
    setDragOverIso(null);
    if (!dragVisitaId) return;
    onReagendar(dragVisitaId, iso);
    setDragVisitaId(null);
  }

  // Mesma regra de editabilidade que o cartão da Semana já usa: rascunho/
  // publicado abre o formulário completo, em_execução vai pro relatório em
  // andamento. Concluída/cancelada/faltou continuam no card leve de detalhe
  // (com "Ver relatório" já disponível pra concluída).
  function abrirVisita(v) {
    setTooltip(null);
    if (v.status === 'rascunho' || v.status === 'publicado') onEditarVisita(v.id);
    else if (v.status === 'em_execucao') onVerRelatorioVisita(v.id);
    else setVisitaAberta(v);
  }

  const grid = modo === 'mes' ? buildGrid(calAno, calMes) : buildGridQuinzena(quinzenaBase);
  const dow  = modo === 'mes' ? DIAS_SEMANA_CURTO : DIAS_SEMANA_SEG;

  const label = modo === 'mes'
    ? `${MESES_PT[calMes]} ${calAno}`
    : `${formatarDataCurta(quinzenaBase)} – ${formatarDataCurta(addDias(quinzenaBase, 13))}`;

  function navegar(delta) {
    if (modo === 'mes') onNavMes(delta);
    else onNavQuinzena(delta * 14);
  }

  function mostrarTooltip(e, visita) {
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: r.right + 10, y: r.top, visita });
  }

  const visitasDoDiaAberto = diaAberto ? (visitasPorDia.get(diaAberto) ?? []) : [];

  return (
    <div className="ec-cal">
      <div className="ec-cal__nav">
        <button className="ec-cal__nav-btn" onClick={() => navegar(-1)}>‹</button>
        <span className="ec-cal__label">{label}</span>
        <button className="ec-cal__nav-btn" onClick={() => navegar(1)}>›</button>
      </div>

      <div className="ec-cal__acoes">
        <button className="ec__btn-add" onClick={() => onAdicionarTarefa(hojeIso)}>
          + Adicionar Tarefa
        </button>
      </div>

      <div className={`ec-cal__grid ${modo === 'mes' ? 'ec-cal__grid--mes' : 'ec-cal__grid--quinzenal'}`}>
        {dow.map(d => <span key={d} className="ec-cal__dow">{d}</span>)}
        {grid.map((iso, i) => {
          if (!iso) return <span key={i} className="ec-cal__cel ec-cal__cel--vazia" />;
          const visitas = visitasPorDia.get(iso) ?? [];
          const isHoje = iso === hojeIso;
          const dia = parseInt(iso.split('-')[2], 10);
          const extras = Math.max(visitas.length - MAX_LINHAS_CELULA, 0);
          const statusDia = visitas.some(v => v.status === 'rascunho') ? 'rascunho' : 'publicado';

          if (visitas.length === 0) {
            return (
              <button
                key={iso}
                className={`ec-cal__cel ec-cal__cel--vazia-clicavel ${dragOverIso === iso ? 'ec-cal__cel--drag-over' : ''}`}
                onClick={() => onAdicionarTarefa(iso)}
                onDragOver={e => { if (dragVisitaId) { e.preventDefault(); setDragOverIso(iso); } }}
                onDragLeave={() => setDragOverIso(null)}
                onDrop={e => { e.preventDefault(); soltarEm(iso); }}
                title="Adicionar tarefa nesse dia"
              >
                <span className={`ec-cal__cel-num ${isHoje ? 'ec-cal__cel-num--hoje' : ''}`}>{dia}</span>
                <span className="ec-cal__cel-add">{dragVisitaId ? 'soltar aqui' : '+ tarefa'}</span>
              </button>
            );
          }

          return (
            <div
              key={iso}
              className={`ec-cal__cel ${dragOverIso === iso ? 'ec-cal__cel--drag-over' : ''}`}
              onDragOver={e => { if (dragVisitaId) { e.preventDefault(); setDragOverIso(iso); } }}
              onDragLeave={() => setDragOverIso(null)}
              onDrop={e => { e.preventDefault(); soltarEm(iso); }}
            >
              <div className="ec-cal__cel-topo">
                <button className="ec-cal__cel-num-btn" onClick={() => setDiaAberto(iso)} title="Ver o dia inteiro">
                  <span className={`ec-cal__cel-num ${isHoje ? 'ec-cal__cel-num--hoje' : ''}`}>{dia}</span>
                </button>
                <span
                  className="ec-cal__cel-resumo"
                  title={statusDia === 'rascunho' ? 'Tem rascunho pendente' : 'Tudo publicado'}
                >
                  <span className={`ec-cal__cel-dot ec-cal__cel-dot--${statusDia}`} />
                  <span className="ec-cal__cel-badge">{visitas.length}</span>
                </span>
              </div>
              {/* Rola com a roda do mouse quando passa por cima — quem
                  prefere não clicar em "mais" vê tudo aqui dentro. */}
              <div className="ec-cal__cel-lista">
                {visitas.map(v => (
                  <button
                    key={v.id}
                    className={`ec-cal__cel-item ${dragVisitaId === v.id ? 'ec-cal__cel-item--arrastando' : ''}`}
                    draggable
                    onDragStart={e => { setDragVisitaId(v.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragVisitaId(null); setDragOverIso(null); }}
                    onMouseEnter={e => mostrarTooltip(e, v)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => abrirVisita(v)}
                  >
                    <span className="ec-cal__cel-item-dot" style={{ background: STATUS_VISITA_COR[v.status] ?? '#9CA3AF' }} />
                    {v.hora && <span className="ec-cal__cel-item-hora">{v.hora}</span>}
                    <span className="ec-cal__cel-item-nome">{v.cliente}</span>
                  </button>
                ))}
              </div>
              {/* Fora da área de scroll — sempre visível, pra quem prefere
                  clicar em vez de rolar. */}
              {extras > 0 && (
                <button className="ec-cal__cel-mais" onClick={() => setDiaAberto(iso)}>
                  mais +{extras}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {loading && <p className="ec-cal__loading">Carregando…</p>}

      {/* ── Balão de hover — detalhe rápido ── */}
      {tooltip && createPortal(
        <div className="ec-cal__tt" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="ec-cal__tt-linha">
            <span className="ec-cal__tt-dot" style={{ background: STATUS_VISITA_COR[tooltip.visita.status] ?? '#9CA3AF' }} />
            <strong>{labelStatusVisita(tooltip.visita.status)}</strong>
          </div>
          <div className="ec-cal__tt-linha">🏢 <strong>{tooltip.visita.cliente}</strong></div>
          {tooltip.visita.endereco && <div className="ec-cal__tt-linha">📍 {tooltip.visita.endereco}</div>}
          {tooltip.visita.duracao && <div className="ec-cal__tt-linha">⏱ {tooltip.visita.duracao} min</div>}
          <div className="ec-cal__tt-linha">👤 {tooltip.visita.funcionario}</div>
        </div>,
        document.body
      )}

      {/* ── Modal "ver o dia inteiro" (número do dia / "mais +N") ── */}
      {diaAberto && (
        <div className="ec-overlay" {...overlayClose}>
          <div className="ec-modal ec-cal__modal">
            <header className="ec-modal__header">
              <div>
                <h3 className="ec-modal__titulo">{formatarDataLonga(diaAberto)}</h3>
                <p className="ec-modal__sub">
                  {visitasDoDiaAberto.length === 0
                    ? 'Nenhuma visita agendada'
                    : `${visitasDoDiaAberto.length} visita${visitasDoDiaAberto.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button className="ec-modal__fechar" onClick={() => setDiaAberto(null)}>✕</button>
            </header>

            <div className="ec-modal__corpo ec-cal__modal-corpo">
              {visitasDoDiaAberto.length === 0 ? (
                <p className="ec-cal__modal-vazio">Nenhuma visita agendada pra esse dia.</p>
              ) : (
                <div className="ec-cal__pop-lista">
                  {visitasDoDiaAberto.map(v => (
                    <div
                      key={v.id}
                      className="ec-cal__pop-item ec-cal__pop-item--clicavel"
                      onClick={() => { setDiaAberto(null); abrirVisita(v); }}
                    >
                      <span className="ec-cal__pop-hora">{v.hora ?? '—'}</span>
                      <div className="ec-cal__pop-info">
                        <span className="ec-cal__pop-cliente">{v.cliente}</span>
                        <span className="ec-cal__pop-func">👤 {v.funcionario}</span>
                      </div>
                      <span className="ec-cal__pop-status" style={{ background: STATUS_VISITA_COR[v.status] ?? '#9CA3AF' }}>
                        {labelStatusVisita(v.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="ec-modal__footer">
              <button className="ec-btn ec-btn--sec" onClick={() => setDiaAberto(null)}>Fechar</button>
              {visitasDoDiaAberto.length > 0 && (
                <button className="ec-btn ec-btn--sec" onClick={() => onSelecionarDia(diaAberto)}>☑ Selecionar</button>
              )}
              <button className="ec-btn ec-btn--pri" onClick={() => onAbrirDia(diaAberto)}>Ver na Escala →</button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Card de detalhe de uma visita específica ── */}
      {visitaAberta && (
        <CardDetalheVisitaCalendario visita={visitaAberta} onFechar={() => setVisitaAberta(null)} />
      )}
    </div>
  );
}
