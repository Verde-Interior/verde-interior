// src/components/Pipeline/Pipeline.jsx
import { useState, useEffect } from 'react';
import KanbanBoard from '../KanbanBoard/KanbanBoard';
import CeasaHolambra from '../CeasaHolambra/CeasaHolambra';
import './Pipeline.css';

const STORAGE_KEY = 'crm-pipeline-aba';

export default function Pipeline() {
  const [aba, setAba] = useState(() => localStorage.getItem(STORAGE_KEY) || 'escritorios');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, aba); }, [aba]);

  return (
    <div className="pipeline">
      <div className="pipeline__tabs">
        <button
          className={`pipeline__tab ${aba === 'escritorios' ? 'pipeline__tab--ativa' : ''}`}
          onClick={() => setAba('escritorios')}
        >
          🏢 Escritórios / Eventos
        </button>
        <button
          className={`pipeline__tab ${aba === 'ceasa' ? 'pipeline__tab--ativa' : ''}`}
          onClick={() => setAba('ceasa')}
        >
          🌱 Ceasa / Holambra
        </button>
      </div>

      <div className="pipeline__conteudo">
        {aba === 'escritorios' && <KanbanBoard />}
        {aba === 'ceasa'       && <CeasaHolambra />}
      </div>
    </div>
  );
}
