// src/components/EscalaCampo/EscalaCalendario.jsx
// Visão de calendário (quinzenal/mês) da Escala — complementa a visão de
// Semana (colunas por funcionário), que continua sendo a padrão pro dia a
// dia. Aqui a unidade é o DIA, não o funcionário: célula por dia com resumo
// (contagem + status), clique abre um popover com a lista de visitas.
import { useState } from 'react';
import { buildGrid, MESES_PT, DIAS_SEMANA_CURTO, formatarDataLonga } from '../../utils/calendarioUtils';
import { getSemana as getSemanaUtil, addDias, formatarDataCurta } from '../../utils/dateUtils';
import { STATUS_VISITA_COR, labelStatusVisita } from '../../utils/escalaHelpers';
import './EscalaCalendario.css';

const DIAS_SEMANA_SEG = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Quinzena = 2 semanas consecutivas (Seg–Dom, mesma semântica da visão de
// Semana) — reaproveita getSemana em vez de reinventar o alinhamento de dias.
function buildGridQuinzena(baseIso) {
  return [...getSemanaUtil(baseIso), ...getSemanaUtil(addDias(baseIso, 7))];
}

// Cor que resume o dia na célula — pior caso primeiro (faltou > rascunho
// pendente > publicado/em execução > tudo concluído).
function corResumoDia(visitas) {
  if (!visitas?.length) return null;
  if (visitas.some(v => v.status === 'faltou'))    return STATUS_VISITA_COR.faltou;
  if (visitas.some(v => v.status === 'rascunho'))  return '#9CA3AF';
  if (visitas.every(v => v.status === 'concluido')) return STATUS_VISITA_COR.concluido;
  return STATUS_VISITA_COR.publicado;
}

export default function EscalaCalendario({
  modo, // 'quinzenal' | 'mes'
  visitasPorDia, // Map<iso, Array<{ id, hora, cliente, funcionario, status }>>
  loading,
  calAno, calMes, onNavMes,
  quinzenaBase, onNavQuinzena,
  hojeIso,
  onAbrirDia,
}) {
  const [diaAberto, setDiaAberto] = useState(null);

  const grid = modo === 'mes' ? buildGrid(calAno, calMes) : buildGridQuinzena(quinzenaBase);
  const dow  = modo === 'mes' ? DIAS_SEMANA_CURTO : DIAS_SEMANA_SEG;

  const label = modo === 'mes'
    ? `${MESES_PT[calMes]} ${calAno}`
    : `${formatarDataCurta(quinzenaBase)} – ${formatarDataCurta(addDias(quinzenaBase, 13))}`;

  function navegar(delta) {
    if (modo === 'mes') onNavMes(delta);
    else onNavQuinzena(delta * 14);
  }

  const visitasDoDiaAberto = diaAberto ? (visitasPorDia.get(diaAberto) ?? []) : [];

  return (
    <div className="ec-cal">
      <div className="ec-cal__nav">
        <button className="ec-cal__nav-btn" onClick={() => navegar(-1)}>‹</button>
        <span className="ec-cal__label">{label}</span>
        <button className="ec-cal__nav-btn" onClick={() => navegar(1)}>›</button>
      </div>

      <div className={`ec-cal__grid ${modo === 'mes' ? 'ec-cal__grid--mes' : 'ec-cal__grid--quinzenal'}`}>
        {dow.map(d => <span key={d} className="ec-cal__dow">{d}</span>)}
        {grid.map((iso, i) => {
          if (!iso) return <span key={i} className="ec-cal__cel ec-cal__cel--vazia" />;
          const visitas = visitasPorDia.get(iso) ?? [];
          const cor = corResumoDia(visitas);
          const isHoje = iso === hojeIso;
          const isAberto = diaAberto === iso;
          const dia = parseInt(iso.split('-')[2], 10);
          return (
            <button
              key={iso}
              className={`ec-cal__cel ec-cal__cel--btn ${isHoje ? 'ec-cal__cel--hoje' : ''} ${isAberto ? 'ec-cal__cel--ativa' : ''}`}
              onClick={() => setDiaAberto(isAberto ? null : iso)}
            >
              <span className="ec-cal__cel-num">{dia}</span>
              {visitas.length > 0 && (
                <span className="ec-cal__cel-resumo">
                  <span className="ec-cal__cel-dot" style={{ background: cor }} />
                  {visitas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && <p className="ec-cal__loading">Carregando…</p>}

      {diaAberto && (
        <div className="ec-cal__pop">
          <div className="ec-cal__pop-head">
            <div>
              <div className="ec-cal__pop-titulo">{formatarDataLonga(diaAberto)}</div>
              <div className="ec-cal__pop-sub">
                {visitasDoDiaAberto.length === 0
                  ? 'Nenhuma visita agendada'
                  : `${visitasDoDiaAberto.length} visita${visitasDoDiaAberto.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            <div className="ec-cal__pop-acoes">
              <button className="ec-cal__pop-ver" onClick={() => onAbrirDia(diaAberto)}>Ver na Escala →</button>
              <button className="ec-cal__pop-fechar" onClick={() => setDiaAberto(null)}>✕</button>
            </div>
          </div>

          {visitasDoDiaAberto.length > 0 && (
            <div className="ec-cal__pop-lista">
              {visitasDoDiaAberto.map(v => (
                <div key={v.id} className="ec-cal__pop-item">
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
      )}
    </div>
  );
}
