// src/components/EscalaCampo/ModalDuplicarVisita.jsx
// Escolhe funcionário e data de destino antes de duplicar uma visita.
import { useState } from 'react';
import { useOverlayClose } from '../../hooks/useOverlayClose';

export default function ModalDuplicarVisita({ visita, funcionarios, onDuplicar, onFechar, duplicando }) {
  const [funcionarioId, setFuncionarioId] = useState(String(visita.funcionario_id ?? ''));
  const [data, setData] = useState(visita.data_agendada ?? '');

  const nomeCliente = visita.clientes?.nome_empresa ?? '—';
  const overlayClose = useOverlayClose(onFechar);

  return (
    <div className="ec-overlay" {...overlayClose}>
      <div className="ec-modal" style={{ maxWidth: 380 }}>
        <header className="ec-modal__header">
          <div>
            <h3 className="ec-modal__titulo">Duplicar visita</h3>
            <p className="ec-modal__sub">{nomeCliente}</p>
          </div>
          <button className="ec-modal__fechar" onClick={onFechar}>✕</button>
        </header>

        <div className="ec-modal__corpo">
          <div className="ec-campo">
            <label>Funcionário de destino</label>
            <select value={funcionarioId} onChange={e => setFuncionarioId(e.target.value)}>
              {funcionarios.map(f => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="ec-campo">
            <label>Data de destino</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
        </div>

        <footer className="ec-modal__footer">
          <button className="ec-btn ec-btn--sec" onClick={onFechar} disabled={duplicando}>Cancelar</button>
          <button
            className="ec-btn ec-btn--pri"
            onClick={() => onDuplicar({ funcionarioId, data })}
            disabled={duplicando || !funcionarioId || !data}
          >
            {duplicando ? 'Duplicando...' : '⧉ Duplicar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
