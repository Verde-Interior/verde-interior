// src/components/Estoque/Estoque.jsx
// Aba Estoque — Etapa 1: lista + KPIs + filtros + sub-abas
// Etapa 2 adiciona: modais de cadastro, movimentação e detalhe
// Etapa 3 adiciona: sub-aba Ferramentas (matriz colaboradores × posse)
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import ModalMaterial from './ModalMaterial';
import ModalMovimento from './ModalMovimento';
import './Estoque.css';

// ── Constantes ────────────────────────────────────────────────

const CATEGORIA_LABEL = {
  vaso:       'Vaso',
  planta:     'Planta',
  cobertura:  'Cobertura',
  substrato:  'Substrato',
  adubo:      'Adubo',
  ferramenta: 'Ferramenta',
  outro:      'Outro',
};

const CATEGORIA_ICON = {
  vaso:       '📦',
  planta:     '🌱',
  cobertura:  '🌰',
  substrato:  '🪴',
  adubo:      '🧪',
  ferramenta: '🔧',
  outro:      '📋',
};

const UNIDADE_LABEL = {
  un: 'un', kg: 'kg', L: 'L', m: 'm', saco: 'sc', frasco: 'fr', rolo: 'rl',
};

// ── Componente principal ──────────────────────────────────────

export default function Estoque() {
  const [aba, setAba] = useState('materiais'); // materiais | ferramentas
  const [saldos, setSaldos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroAlerta, setFiltroAlerta] = useState('todos'); // todos | baixo | zerado
  const [modalMaterial, setModalMaterial] = useState(null);   // null | {} (novo) | material (editar)
  const [modalMovimento, setModalMovimento] = useState(null); // null | {} (novo)

  async function carregar() {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from('estoque_saldos_totais')
      .select('*')
      .order('categoria')
      .order('nome');
    setLoading(false);
    if (error) { setErro(error.message); return; }
    setSaldos(data ?? []);
  }

  useEffect(() => { carregar(); }, []);

  // Divisão por sub-aba
  const listaSubAba = useMemo(() => {
    return saldos.filter(m => aba === 'ferramentas' ? m.controla_posse : !m.controla_posse);
  }, [saldos, aba]);

  // Filtro adicional
  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return listaSubAba.filter(m => {
      if (filtroCategoria !== 'todos' && m.categoria !== filtroCategoria) return false;
      if (filtroAlerta === 'baixo'  && !(m.estoque_minimo > 0 && Number(m.saldo_total) < Number(m.estoque_minimo))) return false;
      if (filtroAlerta === 'zerado' && Number(m.saldo_total) !== 0) return false;
      if (q && !m.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [listaSubAba, busca, filtroCategoria, filtroAlerta]);

  const metricas = useMemo(() => {
    const total = listaSubAba.length;
    const baixo = listaSubAba.filter(m => m.estoque_minimo > 0 && Number(m.saldo_total) < Number(m.estoque_minimo) && Number(m.saldo_total) > 0).length;
    const zerado = listaSubAba.filter(m => Number(m.saldo_total) === 0).length;
    const hoje = new Date().toISOString().split('T')[0];
    const movsHoje = listaSubAba.filter(m => m.ultima_mov && m.ultima_mov.startsWith(hoje)).length;
    return { total, baixo, zerado, movsHoje };
  }, [listaSubAba]);

  // Categorias disponíveis pra filtro (baseadas na sub-aba)
  const categoriasSubAba = useMemo(() => {
    return [...new Set(listaSubAba.map(m => m.categoria))].sort();
  }, [listaSubAba]);

  return (
    <div className="es">
      {/* Header */}
      <header className="es__header">
        <div className="es__header-topo">
          <div>
            <h2 className="es__titulo">Estoque</h2>
            <p className="es__subtitulo">Materiais, ferramentas e movimentações</p>
          </div>
          <div className="es__acoes-topo">
            <button
              className="es__btn-sec"
              onClick={() => setModalMaterial({})}
              title="Cadastrar novo material"
            >
              + Material
            </button>
            <button
              className="es__btn-pri"
              onClick={() => setModalMovimento({})}
              title="Nova movimentação de estoque"
            >
              + Movimento
            </button>
          </div>
        </div>

        {/* Sub-abas */}
        <div className="es__subabas">
          <button
            className={`es__subaba ${aba === 'materiais' ? 'es__subaba--ativa' : ''}`}
            onClick={() => { setAba('materiais'); setFiltroCategoria('todos'); }}
          >
            🌱 Materiais de consumo
          </button>
          <button
            className={`es__subaba ${aba === 'ferramentas' ? 'es__subaba--ativa' : ''}`}
            onClick={() => { setAba('ferramentas'); setFiltroCategoria('todos'); }}
          >
            🔧 Ferramentas
          </button>
        </div>

        {/* KPIs */}
        <div className="es__kpis">
          <div className="es__kpi">
            <span className="es__kpi-valor">{metricas.total}</span>
            <span className="es__kpi-label">{aba === 'ferramentas' ? 'Ferramentas' : 'Materiais'}</span>
          </div>
          <div className={`es__kpi ${metricas.baixo > 0 ? 'es__kpi--warn' : ''}`}>
            <span className="es__kpi-valor">{metricas.baixo}</span>
            <span className="es__kpi-label">Estoque baixo</span>
          </div>
          <div className={`es__kpi ${metricas.zerado > 0 ? 'es__kpi--danger' : ''}`}>
            <span className="es__kpi-valor">{metricas.zerado}</span>
            <span className="es__kpi-label">Zerados</span>
          </div>
          <div className="es__kpi">
            <span className="es__kpi-valor">{metricas.movsHoje}</span>
            <span className="es__kpi-label">Movs. hoje</span>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="es__filtros">
        <div className="es__busca-wrap">
          <span className="es__busca-icon">⌕</span>
          <input
            className="es__busca"
            placeholder="Buscar material..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && <button className="es__busca-clear" onClick={() => setBusca('')}>✕</button>}
        </div>

        {categoriasSubAba.length > 1 && (
          <select className="es__select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="todos">Todas categorias</option>
            {categoriasSubAba.map(c => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c] ?? c}</option>
            ))}
          </select>
        )}

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

        <span className="es__count">
          {filtrados.length} item{filtrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="es__estado">
          <div className="es__spinner" />
          <p>Carregando estoque...</p>
        </div>
      ) : erro ? (
        <div className="es__estado es__estado--erro">
          <p>Erro ao carregar: {erro}</p>
          <button className="es__btn-sec" onClick={carregar}>Tentar novamente</button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="es__estado">
          <p className="es__estado-msg">
            {busca || filtroCategoria !== 'todos' || filtroAlerta !== 'todos'
              ? 'Nenhum item encontrado com esse filtro.'
              : listaSubAba.length === 0
                ? `Nenhuma ${aba === 'ferramentas' ? 'ferramenta cadastrada' : 'categoria de material cadastrada'} ainda.`
                : 'Nenhum item.'}
          </p>
        </div>
      ) : (
        <div className="es__lista">
          {filtrados.map(m => (
            <CartaoMaterial
              key={m.material_id}
              material={m}
              onEditar={() => setModalMaterial({
                id:              m.material_id,
                nome:            m.nome,
                categoria:       m.categoria,
                unidade:         m.unidade,
                sku:             m.sku,
                descricao:       m.descricao,
                foto_url:        m.foto_url,
                estoque_minimo:  m.estoque_minimo,
                controla_posse:  m.controla_posse,
                ativo:           m.ativo ?? true,
              })}
            />
          ))}
        </div>
      )}

      {modalMaterial && (
        <ModalMaterial
          material={modalMaterial.id ? modalMaterial : null}
          onFechar={() => setModalMaterial(null)}
          onSalvo={carregar}
        />
      )}

      {modalMovimento && (
        <ModalMovimento
          onFechar={() => setModalMovimento(null)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}

// ── Cartão do material ────────────────────────────────────────

function CartaoMaterial({ material: m, onEditar }) {
  const saldo = Number(m.saldo_total);
  const minimo = Number(m.estoque_minimo ?? 0);
  const zerado = saldo === 0;
  const baixo = minimo > 0 && saldo > 0 && saldo < minimo;
  const status = zerado ? 'zerado' : baixo ? 'baixo' : 'ok';
  const unidade = UNIDADE_LABEL[m.unidade] ?? m.unidade;

  return (
    <div className={`es-card es-card--${status}`}>
      <div className="es-card__icone">{CATEGORIA_ICON[m.categoria] ?? '📋'}</div>
      <div className="es-card__info">
        <div className="es-card__nome">{m.nome}</div>
        <div className="es-card__meta">
          <span className="es-card__cat">{CATEGORIA_LABEL[m.categoria] ?? m.categoria}</span>
          {minimo > 0 && (
            <span className="es-card__min">· mínimo {Number(minimo)} {unidade}</span>
          )}
          {m.controla_posse && Number(m.saldo_com_colabs) > 0 && (
            <span className="es-card__posse">· {Number(m.saldo_com_colabs)} com colaboradores</span>
          )}
        </div>
      </div>
      <div className={`es-card__saldo es-card__saldo--${status}`}>
        <span className="es-card__saldo-val">{saldo}</span>
        <span className="es-card__saldo-un">{unidade}</span>
        {(zerado || baixo) && (
          <span className="es-card__saldo-alerta">{zerado ? '🚫' : '⚠'}</span>
        )}
      </div>
      {onEditar && (
        <button
          className="es-card__editar"
          onClick={onEditar}
          title="Editar material"
          aria-label={`Editar ${m.nome}`}
        >
          ✏
        </button>
      )}
    </div>
  );
}
