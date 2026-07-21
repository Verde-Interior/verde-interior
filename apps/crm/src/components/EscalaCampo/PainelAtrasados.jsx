// src/components/EscalaCampo/PainelAtrasados.jsx
// Painel de clientes atrasados — extraído de EscalaCampo.jsx (Fase 3.3)
import { useState } from 'react';
import { FREQ_LABEL_LOCAL } from '../../utils/escalaHelpers';

export default function PainelAtrasados({ atrasados, onFechar, onAgendar }) {
  const [aba, setAba] = useState('atrasado');
  const lista = aba === 'atrasado' ? atrasados.atrasado : atrasados.vencendo;

  return (
    <div className="ec-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="ec-modal ec-modal--atras">
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Clientes por prioridade</h3>
            <p className="ec-modal__sub">Baseado em <em>última visita</em> + <em>frequência</em></p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-atras__tabs">
          <button
            className={`ec-atras__tab ${aba === 'atrasado' ? 'ec-atras__tab--ativa' : ''}`}
            onClick={() => setAba('atrasado')}
          >
            🔴 Atrasados ({atrasados.atrasado.length})
          </button>
          <button
            className={`ec-atras__tab ${aba === 'vencendo' ? 'ec-atras__tab--ativa' : ''}`}
            onClick={() => setAba('vencendo')}
          >
            🟡 Vencendo em breve ({atrasados.vencendo.length})
          </button>
        </div>

        <div className="ec-modal__corpo">
          {lista.length === 0 ? (
            <div className="ec-atras__vazio">
              {aba === 'atrasado' ? '✓ Nenhum cliente atrasado.' : 'Nenhum cliente vencendo nos próximos 3 dias.'}
            </div>
          ) : (
            <div className="ec-atras__lista">
              {lista.map(c => (
                <div key={c.id} className={`ec-atras__item ec-atras__item--${aba}`}>
                  <div className="ec-atras__info">
                    <div className="ec-atras__nome">{c.nome_empresa}</div>
                    <div className="ec-atras__meta">
                      {c.bairro && <span>📍 {c.bairro}</span>}
                      {c.frequencia_visita && <span>· {FREQ_LABEL_LOCAL[c.frequencia_visita]}</span>}
                    </div>
                    <div className="ec-atras__hint">
                      {aba === 'atrasado' && c.diasAtraso != null && (
                        <>Última visita: {c.esperado ? new Date(c.esperado + 'T12:00').toLocaleDateString('pt-BR') : '—'} · <strong>{c.diasAtraso} dia{c.diasAtraso !== 1 ? 's' : ''} de atraso</strong></>
                      )}
                      {aba === 'atrasado' && c.diasAtraso == null && (
                        <>⚠ {c.motivo}</>
                      )}
                      {aba === 'vencendo' && (
                        <>Vence em <strong>{c.diasParaVencer} dia{c.diasParaVencer !== 1 ? 's' : ''}</strong> ({new Date(c.esperado + 'T12:00').toLocaleDateString('pt-BR')})</>
                      )}
                    </div>
                  </div>
                  <button className="ec-atras__btn" onClick={() => onAgendar(c)}>
                    + Agendar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
