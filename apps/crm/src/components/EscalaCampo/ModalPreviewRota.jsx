// src/components/EscalaCampo/ModalPreviewRota.jsx
// Modal de preview da rota otimizada — extraído de EscalaCampo.jsx (Fase 3.3)
import { minutosParaHora } from '../../utils/otimizadorRota';

export default function ModalPreviewRota({ resultado, onAplicar, onFechar, aplicando }) {
  const { ordem, ordemGeo, distKmViavel, distKmGeo, timeline, motivos, temViolacao } = resultado;
  const diffKm = distKmViavel - distKmGeo;

  const posGeo = new Map(ordemGeo.map((v, i) => [v.id, i + 1]));

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal ec-modal--atras">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">🧭 Rota otimizada</h3>
            <p className="ec-modal__sub">Ajustada para respeitar janelas de horário</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          {motivos.length > 0 && (
            <div className="ec-preview__motivos">
              <div className="ec-preview__motivos-titulo">⚠ Por que essa não é a rota mais curta:</div>
              {motivos.map(m => (
                <div key={m.visitaId} className="ec-preview__motivo">
                  Priorizei <strong>{m.nome}</strong> ({m.moveuDe + 1}ª → {m.moveuPara + 1}ª posição) porque {m.texto.replace(m.nome, '').trim()}.
                </div>
              ))}
            </div>
          )}

          {temViolacao && (
            <div className="ec-alerta ec-alerta--erro">
              ⚠ Mesmo com esta ordem, alguma visita ficou fora da janela do cliente. Verifique horários manualmente ou aceite para revisar depois.
            </div>
          )}

          <div className="ec-preview__diff-km">
            <div>
              <div className="ec-preview__diff-lbl">Rota escolhida</div>
              <div className="ec-preview__diff-val">{distKmViavel.toFixed(1)} km</div>
            </div>
            <div className="ec-preview__diff-vs">vs</div>
            <div>
              <div className="ec-preview__diff-lbl">Rota mais curta ignorando restrições</div>
              <div className="ec-preview__diff-val ec-preview__diff-val--sec">{distKmGeo.toFixed(1)} km</div>
            </div>
            <div className={diffKm > 0 ? 'ec-preview__diff-tag ec-preview__diff-tag--custo' : 'ec-preview__diff-tag ec-preview__diff-tag--ganho'}>
              {diffKm > 0 ? `+${diffKm.toFixed(1)} km` : `${diffKm.toFixed(1)} km`}
            </div>
          </div>

          <div className="ec-preview__lista">
            <div className="ec-preview__lista-titulo">Nova ordem sugerida</div>
            {ordem.map((v, i) => {
              const t = timeline[i];
              const c = v.clientes ?? {};
              const janela = c.janela_entrada_inicio && c.janela_entrada_fim
                ? `${c.janela_entrada_inicio.slice(0,5)}–${c.janela_entrada_fim.slice(0,5)}`
                : null;
              const posAntes = posGeo.get(v.id);
              const mudou = posAntes !== (i + 1);
              return (
                <div key={v.id} className={`ec-preview__linha ${t.violacaoMin > 0 ? 'ec-preview__linha--viola' : ''}`}>
                  <div className="ec-preview__ord">{i + 1}</div>
                  <div className="ec-preview__info">
                    <div className="ec-preview__nome">{c.nome_empresa ?? '—'}</div>
                    <div className="ec-preview__meta">
                      chegada estimada <strong>{minutosParaHora(t.chegada)}</strong>
                      {janela && <span> · janela {janela}</span>}
                      {t.esperaMin > 0 && <span className="ec-preview__aviso"> · espera {t.esperaMin} min</span>}
                      {t.violacaoMin > 0 && <span className="ec-preview__erro"> · atrasado {t.violacaoMin} min</span>}
                    </div>
                  </div>
                  {mudou && (
                    <div className="ec-preview__mudou" title={`Antes ${posAntes}ª`}>
                      {posAntes > (i + 1) ? '↑' : '↓'} {posAntes}ª→{i + 1}ª
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer className="ec-modal__footer">
          <div className="ec-preview__foot-hint">
            Os horários das visitas serão atualizados para os ETAs calculados.
          </div>
          <button className="ec-btn ec-btn--sec" onClick={onFechar} disabled={aplicando}>Cancelar</button>
          <button className="ec-btn ec-btn--pri" onClick={onAplicar} disabled={aplicando}>
            {aplicando ? 'Aplicando...' : 'Aplicar nova ordem e horários'}
          </button>
        </footer>
      </div>
    </div>
  );
}
