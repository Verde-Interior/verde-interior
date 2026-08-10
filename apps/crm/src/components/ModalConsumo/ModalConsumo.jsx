// src/components/ModalConsumo/ModalConsumo.jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import './ModalConsumo.css';

function formatarBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mediaKbPorFoto(u) {
  if (!u.fotos) return 0;
  return u.bytes / u.fotos / 1024;
}

function Barra({ label, valor, max, sublabel, alerta }) {
  const pct = max > 0 ? Math.max((valor / max) * 100, 2) : 0;
  return (
    <div className="mcons__barra">
      <span className="mcons__barra-label">{label}</span>
      <div className="mcons__barra-track">
        <div
          className={`mcons__barra-fill${alerta ? ' mcons__barra-fill--alerta' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`mcons__barra-val${alerta ? ' mcons__barra-val--alerta' : ''}`}>{sublabel}</span>
    </div>
  );
}

export default function ModalConsumo({
  dados,
  dataInicio,
  dataFim,
  backfillRodando,
  backfillResultado,
  onBackfill,
  onFechar,
}) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onFechar(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onFechar]);

  const overlayClose = useOverlayClose(onFechar);

  const maxBytes  = Math.max(...dados.map(u => u.bytes), 1);
  const maxFotos  = Math.max(...dados.map(u => u.fotos), 1);
  const maxMedia  = Math.max(...dados.map(u => mediaKbPorFoto(u)), 1);

  // Mediana da média por foto — usada para detectar outliers
  const medias = [...dados].map(u => mediaKbPorFoto(u)).sort((a, b) => a - b);
  const mediana = medias.length ? medias[Math.floor(medias.length / 2)] : 0;
  const limiteAlerta = Math.max(mediana * 3, 200);

  const totalBytes = dados.reduce((s, u) => s + u.bytes, 0);
  const totalFotos = dados.reduce((s, u) => s + u.fotos, 0);

  const fmtData = (iso) =>
    iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

  return createPortal(
    <div className="mcons-overlay" {...overlayClose}>
      <div className="mcons-modal" role="dialog" aria-modal="true" aria-labelledby="mcons-titulo">
        <div className="mcons__header">
          <div>
            <h3 className="mcons__titulo" id="mcons-titulo">Uso de Storage — Fotos de Campo</h3>
            <p className="mcons__periodo">
              {fmtData(dataInicio)} → {fmtData(dataFim)}
              &nbsp;·&nbsp;{totalFotos} fotos&nbsp;·&nbsp;{formatarBytes(totalBytes)} total
            </p>
          </div>
          <button className="mcons__fechar" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        {dados.length === 0 ? (
          <p className="mcons__vazio">Sem fotos no período selecionado.</p>
        ) : (
          <div className="mcons__corpo">
            <section className="mcons__secao">
              <h4 className="mcons__secao-titulo">Dados consumidos por colaborador</h4>
              {dados.map(u => (
                <Barra
                  key={u.nome}
                  label={u.nome}
                  valor={u.bytes}
                  max={maxBytes}
                  sublabel={formatarBytes(u.bytes)}
                />
              ))}
            </section>

            <section className="mcons__secao">
              <h4 className="mcons__secao-titulo">Fotos registradas por colaborador</h4>
              {dados.map(u => (
                <Barra
                  key={u.nome}
                  label={u.nome}
                  valor={u.fotos}
                  max={maxFotos}
                  sublabel={`${u.fotos} foto${u.fotos !== 1 ? 's' : ''}`}
                />
              ))}
            </section>

            <section className="mcons__secao">
              <h4 className="mcons__secao-titulo">
                Média por foto
                <span className="mcons__secao-hint"> — valores altos indicam falha de compressão</span>
              </h4>
              {dados.map(u => {
                const media = mediaKbPorFoto(u);
                const alerta = media > limiteAlerta;
                return (
                  <Barra
                    key={u.nome}
                    label={u.nome}
                    valor={media}
                    max={maxMedia}
                    sublabel={`${media < 1024 ? `${media.toFixed(0)} KB` : `${(media / 1024).toFixed(1)} MB`}/foto`}
                    alerta={alerta}
                  />
                );
              })}
              {mediana > 0 && (
                <p className="mcons__nota">
                  Mediana: {mediana.toFixed(0)} KB/foto · Alerta acima de {limiteAlerta.toFixed(0)} KB/foto
                </p>
              )}
            </section>
          </div>
        )}

        <div className="mcons__rodape">
          <button
            className="mcons__btn-backfill"
            onClick={onBackfill}
            disabled={backfillRodando}
            title="Preenche o tamanho das fotos enviadas antes desse recurso existir"
          >
            {backfillRodando ? '⏳ Calculando...' : '🔄 Calcular fotos antigas (sem tamanho)'}
          </button>
          {backfillResultado && (
            backfillResultado.erro
              ? <span className="mcons__backfill-msg mcons__backfill-msg--erro">Erro: {backfillResultado.erro}</span>
              : <span className="mcons__backfill-msg">
                  {backfillResultado.atualizadas > 0
                    ? `${backfillResultado.atualizadas} foto${backfillResultado.atualizadas !== 1 ? 's' : ''} atualizada${backfillResultado.atualizadas !== 1 ? 's' : ''}`
                    : 'Nada pendente'}
                  {backfillResultado.falhas > 0 && ` · ${backfillResultado.falhas} não encontrada(s)`}
                </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
