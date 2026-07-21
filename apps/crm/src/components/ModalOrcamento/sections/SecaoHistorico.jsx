// src/components/ModalOrcamento/sections/SecaoHistorico.jsx
// Seção de histórico de atividades do lead — extraído de ModalOrcamento.jsx (Fase 4.1)

const ICONE = { estagio: '🔄', followup: '📅', orcamento: '📎', visita: '🗺️' };

export default function SecaoHistorico({ historico }) {
  if (!historico?.length) return null;

  return (
    <section className="modal__secao modal__secao--historico">
      <h3 className="modal__secao-titulo">📋 Histórico de Atividades</h3>
      <div className="modal__historico-lista">
        {[...historico].reverse().map((entry) => {
          const dataFmt = new Date(entry.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
          return (
            <div key={entry.id} className={`modal__historico-item modal__historico-item--${entry.tipo}`}>
              <span className="modal__historico-icone">{ICONE[entry.tipo] ?? '📌'}</span>
              <span className="modal__historico-desc">{entry.descricao}</span>
              <span className="modal__historico-data">{dataFmt}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
