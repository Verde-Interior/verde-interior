// src/components/GlobalSearch/GlobalSearch.jsx
import { useState, useEffect, useRef } from 'react';
import { useCRM } from '../../context/CRMContext';
import './GlobalSearch.css';

export default function GlobalSearch({ onFechar, onNavegar }) {
  const { leads, TIPOS_SERVICO, ESTAGIOS, abrirModal, getTiposServico } = useCRM();
  const [query, setQuery]         = useState('');
  const [selecionado, setSel]     = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const resultados = query.trim().length >= 1
    ? leads.filter((l) => {
        const q = query.toLowerCase();
        return (
          l.empresa?.toLowerCase().includes(q) ||
          l.contato?.toLowerCase().includes(q) ||
          l.bairro?.toLowerCase().includes(q) ||
          l.telefone?.includes(q)
        );
      }).slice(0, 8)
    : [];

  function abrir(lead) {
    onFechar();
    onNavegar('kanban');
    setTimeout(() => abrirModal(lead), 80);
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSel((v) => Math.min(v + 1, resultados.length - 1)); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSel((v) => Math.max(v - 1, 0)); }
    if (e.key === 'Enter' && resultados[selecionado]) abrir(resultados[selecionado]);
    if (e.key === 'Escape') onFechar();
  }

  const cor = (id) => ESTAGIOS.find((e) => e.id === id)?.cor ?? '#6B7280';
  const label = (id) => ESTAGIOS.find((e) => e.id === id)?.label ?? id;

  return (
    <div className="gsearch-overlay" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="gsearch" role="dialog" aria-modal="true">

        {/* Input */}
        <div className="gsearch__input-wrap">
          <span className="gsearch__icon">⌕</span>
          <input
            ref={inputRef}
            className="gsearch__input"
            placeholder="Buscar lead por empresa, contato ou bairro…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={handleKey}
          />
          <kbd className="gsearch__esc" onClick={onFechar}>Esc</kbd>
        </div>

        {/* Resultados */}
        {resultados.length > 0 && (
          <ul className="gsearch__lista">
            {resultados.map((lead, i) => {
              const tipos = getTiposServico(lead);
              const svcPrimario = tipos[0] ? TIPOS_SERVICO[tipos[0]] : null;
              const labelSvc = tipos.length > 1
                ? `${svcPrimario?.label ?? tipos[0]} +${tipos.length - 1}`
                : (svcPrimario?.label ?? '—');
              return (
                <li
                  key={lead.id}
                  className={`gsearch__item ${i === selecionado ? 'gsearch__item--ativo' : ''}`}
                  onClick={() => abrir(lead)}
                  onMouseEnter={() => setSel(i)}
                >
                  <div className="gsearch__item-esq">
                    <span className="gsearch__empresa">{lead.empresa}</span>
                    <span className="gsearch__contato">{lead.contato} · 📍 {lead.bairro}</span>
                  </div>
                  <div className="gsearch__item-dir">
                    <span
                      className="gsearch__badge-svc"
                      style={{ '--cor': svcPrimario?.cor ?? '#6B7280' }}
                    >
                      {labelSvc}
                    </span>
                    <span
                      className="gsearch__badge-est"
                      style={{ '--cor': cor(lead.estagioId) }}
                    >
                      {label(lead.estagioId)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {query.trim().length > 0 && resultados.length === 0 && (
          <div className="gsearch__vazio">Nenhum lead encontrado para "<strong>{query}</strong>"</div>
        )}

        {/* Dicas */}
        <div className="gsearch__footer">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </div>
  );
}
