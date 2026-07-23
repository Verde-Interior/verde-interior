// src/components/Estoque/itens/ItensTab.jsx
// Shared por Insumos, Vasos e Materiais — usa estoque_itens + estoque_itens_movs
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import ModalItem         from './ModalItem';
import ModalMovimentoItem from './ModalMovimentoItem';

const UNIDADE_LABEL = { un:'un', kg:'kg', L:'L', m:'m', saco:'sc', frasco:'fr', rolo:'rl' };

function CartaoItem({ item: m, onEditar }) {
  const saldo = Number(m.saldo_total);
  const minimo = Number(m.estoque_minimo ?? 0);
  const zerado = saldo === 0;
  const baixo  = minimo > 0 && saldo > 0 && saldo < minimo;
  const status = zerado ? 'zerado' : baixo ? 'baixo' : 'ok';
  const un = UNIDADE_LABEL[m.unidade] ?? m.unidade;

  return (
    <div className={`es-card es-card--${status}`}>
      <div className="es-card__info">
        <div className="es-card__nome">{m.nome}</div>
        <div className="es-card__meta">
          {minimo > 0 && <span className="es-card__min">mínimo {Number(minimo)} {un}</span>}
          {m.controla_posse && Number(m.saldo_com_colabs) > 0 && (
            <span className="es-card__posse">· {Number(m.saldo_com_colabs)} com colaboradores</span>
          )}
        </div>
      </div>
      <div className={`es-card__saldo es-card__saldo--${status}`}>
        <span className="es-card__saldo-val">{saldo}</span>
        <span className="es-card__saldo-un">{un}</span>
        {(zerado || baixo) && (
          <span className="es-card__saldo-alerta">{zerado ? '🚫' : '⚠'}</span>
        )}
      </div>
      {onEditar && (
        <button className="es-card__editar" onClick={onEditar} title="Editar">✏</button>
      )}
    </div>
  );
}

export default function ItensTab({ categoria, titulo }) {
  const [itens,        setItens]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [erro,         setErro]         = useState(null);
  const [busca,        setBusca]        = useState('');
  const [filtroAlerta, setFiltroAlerta] = useState('todos');
  const [modalItem,    setModalItem]    = useState(null);
  const [modalMov,     setModalMov]     = useState(false);

  async function carregar() {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from('estoque_itens_saldo_total')
      .select('*')
      .eq('categoria', categoria)
      .order('nome');
    setLoading(false);
    if (error) { setErro(error.message); return; }
    setItens(data ?? []);
  }

  useEffect(() => { carregar(); }, [categoria]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return itens.filter(m => {
      if (filtroAlerta === 'baixo'  && !(Number(m.estoque_minimo) > 0 && Number(m.saldo_total) < Number(m.estoque_minimo) && Number(m.saldo_total) > 0)) return false;
      if (filtroAlerta === 'zerado' && Number(m.saldo_total) !== 0) return false;
      if (q && !m.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [itens, busca, filtroAlerta]);

  const kpis = useMemo(() => ({
    total:  itens.length,
    baixo:  itens.filter(m => Number(m.estoque_minimo) > 0 && Number(m.saldo_total) > 0 && Number(m.saldo_total) < Number(m.estoque_minimo)).length,
    zerado: itens.filter(m => Number(m.saldo_total) === 0).length,
  }), [itens]);

  return (
    <>
      <div className="es__kpis">
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.total}</span>
          <span className="es__kpi-label">{titulo}</span>
        </div>
        <div className={`es__kpi ${kpis.baixo > 0 ? 'es__kpi--warn' : ''}`}>
          <span className="es__kpi-valor">{kpis.baixo}</span>
          <span className="es__kpi-label">Estoque baixo</span>
        </div>
        <div className={`es__kpi ${kpis.zerado > 0 ? 'es__kpi--danger' : ''}`}>
          <span className="es__kpi-valor">{kpis.zerado}</span>
          <span className="es__kpi-label">Zerados</span>
        </div>
      </div>

      <div className="es__filtros">
        <div className="es__busca-wrap">
          <span className="es__busca-icon">⌕</span>
          <input
            className="es__busca"
            placeholder={`Buscar ${titulo.toLowerCase()}...`}
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && <button className="es__busca-clear" onClick={() => setBusca('')}>✕</button>}
        </div>

        <div className="es__filtros-pills">
          {[
            { id: 'todos',  label: 'Todos' },
            { id: 'baixo',  label: '⚠ Baixo' },
            { id: 'zerado', label: '🚫 Zerado' },
          ].map(f => (
            <button
              key={f.id}
              className={`es__pill ${filtroAlerta === f.id ? 'es__pill--ativo' : ''}`}
              onClick={() => setFiltroAlerta(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="es__count">{filtrados.length} item{filtrados.length !== 1 ? 's' : ''}</span>

        <button className="es__btn-sec" onClick={() => setModalItem({})}>+ {titulo.slice(0, -1)}</button>
        <button className="es__btn-pri" onClick={() => setModalMov(true)}>+ Movimento</button>
      </div>

      {loading ? (
        <div className="es__estado"><div className="es__spinner" /><p>Carregando {titulo.toLowerCase()}...</p></div>
      ) : erro ? (
        <div className="es__estado es__estado--erro">
          <p>Erro: {erro}</p>
          <button className="es__btn-sec" onClick={carregar}>Tentar novamente</button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="es__estado">
          <p className="es__estado-msg">
            {itens.length === 0 ? `Nenhum(a) ${titulo.toLowerCase().slice(0,-1)} cadastrado(a).` : 'Nenhum resultado com esse filtro.'}
          </p>
        </div>
      ) : (
        <div className="es__lista">
          {filtrados.map(m => (
            <CartaoItem
              key={m.item_id}
              item={m}
              onEditar={() => setModalItem({
                id: m.item_id, nome: m.nome, categoria: m.categoria, unidade: m.unidade,
                sku: m.sku, descricao: m.descricao, foto_url: m.foto_url,
                estoque_minimo: m.estoque_minimo, controla_posse: m.controla_posse, ativo: m.ativo,
              })}
            />
          ))}
        </div>
      )}

      {modalItem && (
        <ModalItem
          item={modalItem.id ? modalItem : null}
          categoriaFixa={categoria}
          onFechar={() => setModalItem(null)}
          onSalvo={carregar}
        />
      )}
      {modalMov && (
        <ModalMovimentoItem
          categoriaFixa={categoria}
          onFechar={() => setModalMov(false)}
          onSalvo={carregar}
        />
      )}
    </>
  );
}
