// src/components/GlobalSearch/GlobalSearch.jsx
import { useState, useEffect, useRef } from 'react';
import { useCRM } from '../../context/CRMContext';
import { supabase } from '../../lib/supabase';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import './GlobalSearch.css';

export default function GlobalSearch({ onFechar, onNavegar }) {
  const { leads, TIPOS_SERVICO, ESTAGIOS, abrirModal, getTiposServico } = useCRM();
  const [query, setQuery]         = useState('');
  const [selecionado, setSel]     = useState(0);
  const [clientes, setClientes]   = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Clientes já cadastrados não ficam no CRMContext (só leads) — busca uma
  // vez, ao abrir, a lista inteira (mesmo padrão já usado em Clientes/Mapa/
  // Escala, que também carregam tudo e filtram no cliente).
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_empresa, contato_nome, contato_telefone, bairro, grupo_servico')
        .eq('ativo', true);
      setClientes(data ?? []);
    })();
  }, []);

  const q = query.trim().toLowerCase();

  const leadsResultado = q.length >= 1
    ? leads
        .filter((l) => (
          l.empresa?.toLowerCase().includes(q) ||
          l.contato?.toLowerCase().includes(q) ||
          l.bairro?.toLowerCase().includes(q) ||
          l.telefone?.includes(q)
        ))
        .map((l) => ({ ...l, _tipo: 'lead' }))
    : [];

  const clientesResultado = q.length >= 1
    ? clientes
        .filter((c) => (
          c.nome_empresa?.toLowerCase().includes(q) ||
          c.contato_nome?.toLowerCase().includes(q) ||
          c.bairro?.toLowerCase().includes(q) ||
          c.contato_telefone?.includes(q)
        ))
        .map((c) => ({ ...c, _tipo: 'cliente' }))
    : [];

  const resultados = [...leadsResultado, ...clientesResultado].slice(0, 8);

  function abrir(item) {
    onFechar();
    if (item._tipo === 'cliente') {
      window.history.pushState({}, '', `?tela=clientes&cliente=${item.id}`);
      onNavegar('clientes');
      return;
    }
    onNavegar('kanban');
    setTimeout(() => abrirModal(item), 80);
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSel((v) => Math.min(v + 1, resultados.length - 1)); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSel((v) => Math.max(v - 1, 0)); }
    if (e.key === 'Enter' && resultados[selecionado]) abrir(resultados[selecionado]);
    if (e.key === 'Escape') onFechar();
  }

  const cor = (id) => ESTAGIOS.find((e) => e.id === id)?.cor ?? '#6B7280';
  const label = (id) => ESTAGIOS.find((e) => e.id === id)?.label ?? id;

  const overlayClose = useOverlayClose(onFechar);

  return (
    <div className="gsearch-overlay" {...overlayClose}>
      <div className="gsearch" role="dialog" aria-modal="true">

        {/* Input */}
        <div className="gsearch__input-wrap">
          <span className="gsearch__icon">⌕</span>
          <input
            ref={inputRef}
            className="gsearch__input"
            placeholder="Buscar lead ou cliente por empresa, contato ou bairro…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={handleKey}
          />
          <kbd className="gsearch__esc" onClick={onFechar}>Esc</kbd>
        </div>

        {/* Resultados */}
        {resultados.length > 0 && (
          <ul className="gsearch__lista">
            {resultados.map((item, i) => {
              if (item._tipo === 'cliente') {
                return (
                  <li
                    key={`cliente-${item.id}`}
                    className={`gsearch__item ${i === selecionado ? 'gsearch__item--ativo' : ''}`}
                    onClick={() => abrir(item)}
                    onMouseEnter={() => setSel(i)}
                  >
                    <div className="gsearch__item-esq">
                      <span className="gsearch__empresa">{item.nome_empresa}</span>
                      <span className="gsearch__contato">{item.contato_nome ?? '—'} · 📍 {item.bairro ?? '—'}</span>
                    </div>
                    <div className="gsearch__item-dir">
                      {item.grupo_servico && (
                        <span className="gsearch__badge-svc" style={{ '--cor': '#6B7280' }}>{item.grupo_servico}</span>
                      )}
                      <span className="gsearch__badge-tipo gsearch__badge-tipo--cliente">Cliente</span>
                    </div>
                  </li>
                );
              }

              const lead = item;
              const tipos = getTiposServico(lead);
              const svcPrimario = tipos[0] ? TIPOS_SERVICO[tipos[0]] : null;
              const labelSvc = tipos.length > 1
                ? `${svcPrimario?.label ?? tipos[0]} +${tipos.length - 1}`
                : (svcPrimario?.label ?? '—');
              return (
                <li
                  key={`lead-${lead.id}`}
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
                    <span className="gsearch__badge-tipo gsearch__badge-tipo--lead">Lead</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {query.trim().length > 0 && resultados.length === 0 && (
          <div className="gsearch__vazio">Nenhum resultado para "<strong>{query}</strong>"</div>
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
