// src/components/Orcamentos/CatalogoModal/CatalogoModal.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import './CatalogoModal.css';

export default function CatalogoModal({ onSelecionar, onFechar }) {
  const [itens, setItens]       = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca]       = useState('');
  const [filtroTipo, setFiltroTipo]     = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('catalogo_itens')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      setItens(data ?? []);
      setCarregando(false);
    })();
  }, []);

  const itensFiltrados = itens.filter(it => {
    if (filtroTipo      && it.tipo      !== filtroTipo)      return false;
    if (filtroCategoria && it.categoria !== filtroCategoria) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!it.nome.toLowerCase().includes(q) && !(it.nome_cientifico ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="cat-modal__overlay" onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="cat-modal">
        <div className="cat-modal__header">
          <h2 className="cat-modal__titulo">Catálogo de Itens</h2>
          <button className="cat-modal__fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="cat-modal__filtros">
          <input
            className="cat-modal__busca"
            type="search"
            placeholder="Buscar planta ou vaso..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            autoFocus
          />
          <select className="cat-modal__select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="planta">Planta</option>
            <option value="vaso">Vaso</option>
            <option value="extra">Extra</option>
          </select>
          <select className="cat-modal__select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            <option value="escritorio">Escritório</option>
            <option value="eventos">Eventos</option>
            <option value="geral">Geral</option>
          </select>
        </div>

        <div className="cat-modal__corpo">
          {carregando ? (
            <div className="cat-modal__vazio">Carregando catálogo...</div>
          ) : itensFiltrados.length === 0 ? (
            <div className="cat-modal__vazio">Nenhum item encontrado.</div>
          ) : (
            <div className="cat-modal__grid">
              {itensFiltrados.map(it => (
                <button
                  key={it.id}
                  className="cat-modal__card"
                  onClick={() => onSelecionar(it)}
                >
                  <div className="cat-modal__foto-wrap">
                    {it.foto_url
                      ? <img src={it.foto_url} alt={it.nome} className="cat-modal__foto" />
                      : <span className="cat-modal__foto-placeholder">🌿</span>
                    }
                  </div>
                  <div className="cat-modal__info">
                    <span className="cat-modal__nome">{it.nome}</span>
                    {it.nome_cientifico && <span className="cat-modal__cientifico">{it.nome_cientifico}</span>}
                    {it.preco_referencia && (
                      <span className="cat-modal__preco">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.preco_referencia)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
