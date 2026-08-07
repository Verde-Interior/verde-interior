// src/components/EscalaCampo/CardDetalheVisitaCalendario.jsx
// Card de detalhe de uma visita, aberto ao clicar numa linha dentro de uma
// célula da visão de calendário (Quinzenal/Mês) da Escala. Layout em duas
// colunas com mapa discreto — inspirado num sistema de referência que o
// usuário mostrou, adaptado aos campos que realmente temos (sem "código da
// tarefa", "criado por" ou "tipo de check-in", que não existem no modelo).
import { useOverlayClose } from '../../hooks/useOverlayClose';
import { TIPO_LABEL, PRIORIDADE_LABEL, labelStatusVisita, corStatusVisita, textoObsDeTipos } from '../../utils/escalaHelpers';
import { FREQ_VISITA_LABEL } from '../../utils/clienteConstants';
import { formatarDataLonga } from '../../utils/calendarioUtils';
import { formatarDuracao } from '../../utils/formatUtils';
import MiniMapaVisita from './MiniMapaVisita';
import './CardDetalheVisitaCalendario.css';

function horaCurta(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Duração real = tempo entre check-in e check-out (só existe depois que o
// colaborador executou a visita) — diferente de "duração estimada", que é
// planejada no cadastro do cliente/na tarefa.
function duracaoReal(checkinAt, checkoutAt) {
  if (!checkinAt || !checkoutAt) return null;
  const min = Math.round((new Date(checkoutAt) - new Date(checkinAt)) / 60000);
  return min > 0 ? min : null;
}

export default function CardDetalheVisitaCalendario({ visita, onFechar }) {
  const overlayClose = useOverlayClose(onFechar);
  const descricao = visita.observacoes?.trim() || textoObsDeTipos(visita.tiposTarefa) || 'Sem descrição.';
  const tiposLabel = visita.tiposTarefa.length
    ? visita.tiposTarefa.map(t => TIPO_LABEL[t] ?? t).join(', ')
    : '—';
  const checkin  = horaCurta(visita.checkinAt);
  const checkout = horaCurta(visita.checkoutAt);
  const realMin  = duracaoReal(visita.checkinAt, visita.checkoutAt);

  return (
    <div className="ec-overlay" {...overlayClose}>
      <div className="ec-modal ec-cdv">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">{visita.cliente}</h3>
            <p className="ec-modal__sub">{formatarDataLonga(visita.dataAgendada)} · {visita.hora ?? '—'}</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo ec-cdv__corpo">
          <div className="ec-cdv__col">
            {visita.endereco && (
              <div className="ec-cdv__campo">
                <span className="ec-cdv__lbl">📍 Endereço</span>
                <span className="ec-cdv__val">{visita.endereco}</span>
              </div>
            )}
            <MiniMapaVisita lat={visita.lat} lng={visita.lng} />
            <div className="ec-cdv__campo">
              <span className="ec-cdv__lbl">👤 Responsável</span>
              <span className="ec-cdv__val">
                {visita.funcionario}
                {(checkin || checkout) && (
                  <span className="ec-cdv__val-sub">
                    {checkin  && `Check-in ${checkin}`}
                    {checkin && checkout && ' · '}
                    {checkout && `Check-out ${checkout}`}
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="ec-cdv__col">
            <div className="ec-cdv__campo">
              <span className="ec-cdv__lbl">Descrição da tarefa</span>
              <span className="ec-cdv__val">{descricao}</span>
            </div>
            <div className="ec-cdv__grid2">
              <div className="ec-cdv__campo">
                <span className="ec-cdv__lbl">Tipo de tarefa</span>
                <span className="ec-cdv__val">{tiposLabel}</span>
              </div>
              <div className="ec-cdv__campo">
                <span className="ec-cdv__lbl">Duração estimada</span>
                <span className="ec-cdv__val">{visita.duracao ? `${visita.duracao} min` : '—'}</span>
              </div>
            </div>
            <div className="ec-cdv__grid2">
              <div className="ec-cdv__campo">
                <span className="ec-cdv__lbl">Duração real</span>
                <span className="ec-cdv__val">{realMin ? formatarDuracao(realMin) : '—'}</span>
              </div>
              <div className="ec-cdv__campo">
                <span className="ec-cdv__lbl">Status</span>
                <span className="ec-cdv__status" style={{ background: corStatusVisita(visita.status) }}>
                  {labelStatusVisita(visita.status)}
                </span>
              </div>
            </div>
            <div className="ec-cdv__grid2">
              {visita.prioridade && (
                <div className="ec-cdv__campo">
                  <span className="ec-cdv__lbl">Prioridade</span>
                  <span className="ec-cdv__val">{PRIORIDADE_LABEL[visita.prioridade] ?? visita.prioridade}</span>
                </div>
              )}
              {visita.frequenciaVisita && (
                <div className="ec-cdv__campo">
                  <span className="ec-cdv__lbl">Frequência de visita</span>
                  <span className="ec-cdv__val">{FREQ_VISITA_LABEL[visita.frequenciaVisita] ?? visita.frequenciaVisita}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
