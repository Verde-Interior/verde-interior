// src/components/Estoque/plantas/PlantasTab.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import ModalNovoPatrimonio   from './ModalNovoPatrimonio';
import ModalEventoPatrimonio from './ModalEventoPatrimonio';
import ModalHistorico        from './ModalHistorico';

const STATUS_LABEL = {
  disponivel:    'Disponível',
  em_cliente:    'No cliente',
  em_manutencao: 'Manutenção',
  descartado:    'Descartado',
};

const STATUS_COR = {
  disponivel:    'verde',
  em_cliente:    'azul',
  em_manutencao: 'amarelo',
  descartado:    'cinza',
};

function diasDesde(isoStr) {
  if (!isoStr) return null;
  const diff = Date.now() - new Date(isoStr).getTime();
  return Math.floor(diff / 86400000);
}

function BadgeStatus({ status }) {
  return (
    <span className={`ep-badge ep-badge--${STATUS_COR[status] ?? 'cinza'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function PatrimonioCard({ p, onEvento, onHistorico }) {
  const dias = diasDesde(p.instalado_em);
  return (
    <div className={`es-card ep-card ${p.status === 'descartado' ? 'ep-card--descartado' : ''}`}>
      <div className="ep-card__qr">{p.qr_codigo}</div>
      <div className="ep-card__info">
        <div className="ep-card__especie">{p.especie_nome}</div>
        <div className="ep-card__meta">
          {p.cliente_nome && <span className="ep-card__cliente">{p.cliente_nome}</span>}
          {p.cliente_nome && dias != null && (
            <span className="ep-card__dias">· {dias}d</span>
          )}
          {p.localizacao_interna && !p.cliente_nome && (
            <span className="ep-card__loc">{p.localizacao_interna}</span>
          )}
          {p.manutencao_aberta_id && (
            <span className="ep-card__manut-aviso">⚠ manutenção aberta</span>
          )}
        </div>
      </div>
      <BadgeStatus status={p.status} />
      <div className="ep-card__acoes">
        <button className="es-card__editar" onClick={() => onHistorico(p)} title="Ver histórico">📋</button>
        {p.status !== 'descartado' && (
          <button className="es-card__editar" onClick={() => onEvento(p)} title="Registrar evento">+</button>
        )}
      </div>
    </div>
  );
}

export default function PlantasTab() {
  const [patrimonios, setPatrimonios] = useState([]);
  const [especies,    setEspecies]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [erro,        setErro]        = useState(null);
  const [busca,       setBusca]       = useState('');
  const [filtroStatus,  setFiltroStatus]  = useState('todos');
  const [filtroEspecie, setFiltroEspecie] = useState('');
  const [modalNovo,     setModalNovo]     = useState(false);
  const [modalEvento,   setModalEvento]   = useState(null);  // patrimônio
  const [modalHistorico,setModalHistorico]= useState(null);  // patrimônio

  async function carregar() {
    setLoading(true);
    setErro(null);
    const [{ data: pats, error: e1 }, { data: esps, error: e2 }] = await Promise.all([
      supabase.from('estoque_patrimonios_view').select('*').order('qr_codigo'),
      supabase.from('estoque_especies').select('id, nome').eq('ativo', true).order('nome'),
    ]);
    setLoading(false);
    if (e1 || e2) { setErro((e1 ?? e2).message); return; }
    setPatrimonios(pats ?? []);
    setEspecies(esps ?? []);
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return patrimonios.filter(p => {
      if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
      if (filtroEspecie && p.especie_id !== filtroEspecie) return false;
      if (q) {
        const texto = `${p.qr_codigo} ${p.especie_nome} ${p.cliente_nome ?? ''} ${p.localizacao_interna ?? ''}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [patrimonios, busca, filtroStatus, filtroEspecie]);

  const kpis = useMemo(() => {
    const ativos = patrimonios.filter(p => p.status !== 'descartado');
    return {
      total:       ativos.length,
      disponivel:  ativos.filter(p => p.status === 'disponivel').length,
      em_cliente:  ativos.filter(p => p.status === 'em_cliente').length,
      manutencao:  ativos.filter(p => p.status === 'em_manutencao').length,
    };
  }, [patrimonios]);

  return (
    <>
      {/* KPIs */}
      <div className="es__kpis es__kpis--plantas">
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.total}</span>
          <span className="es__kpi-label">Total ativas</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.disponivel}</span>
          <span className="es__kpi-label">Disponíveis</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.em_cliente}</span>
          <span className="es__kpi-label">No cliente</span>
        </div>
        <div className={`es__kpi ${kpis.manutencao > 0 ? 'es__kpi--warn' : ''}`}>
          <span className="es__kpi-valor">{kpis.manutencao}</span>
          <span className="es__kpi-label">Manutenção</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="es__filtros">
        <div className="es__busca-wrap">
          <span className="es__busca-icon">⌕</span>
          <input
            className="es__busca"
            placeholder="Buscar por código, espécie, cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && <button className="es__busca-clear" onClick={() => setBusca('')}>✕</button>}
        </div>

        <select className="es__select" value={filtroEspecie} onChange={e => setFiltroEspecie(e.target.value)}>
          <option value="">Todas as espécies</option>
          {especies.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>

        <div className="es__filtros-pills">
          {[
            { id: 'todos',        label: 'Todos' },
            { id: 'disponivel',   label: 'Disponível' },
            { id: 'em_cliente',   label: 'No cliente' },
            { id: 'em_manutencao',label: 'Manutenção' },
            { id: 'descartado',   label: 'Descartados' },
          ].map(f => (
            <button
              key={f.id}
              className={`es__pill ${filtroStatus === f.id ? 'es__pill--ativo' : ''}`}
              onClick={() => setFiltroStatus(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="es__count">{filtrados.length} patrimônio{filtrados.length !== 1 ? 's' : ''}</span>

        <button className="es__btn-pri" onClick={() => setModalNovo(true)}>+ Nova planta</button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="es__estado"><div className="es__spinner" /><p>Carregando plantas...</p></div>
      ) : erro ? (
        <div className="es__estado es__estado--erro">
          <p>Erro: {erro}</p>
          <button className="es__btn-sec" onClick={carregar}>Tentar novamente</button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="es__estado">
          <p className="es__estado-msg">
            {patrimonios.length === 0
              ? 'Nenhuma planta cadastrada ainda.'
              : 'Nenhuma planta com esse filtro.'}
          </p>
        </div>
      ) : (
        <div className="es__lista">
          {filtrados.map(p => (
            <PatrimonioCard
              key={p.id}
              p={p}
              onEvento={setModalEvento}
              onHistorico={setModalHistorico}
            />
          ))}
        </div>
      )}

      {modalNovo && (
        <ModalNovoPatrimonio
          especies={especies}
          onFechar={() => setModalNovo(false)}
          onSalvo={carregar}
        />
      )}
      {modalEvento && (
        <ModalEventoPatrimonio
          patrimonio={modalEvento}
          especies={especies}
          onFechar={() => setModalEvento(null)}
          onSalvo={() => { setModalEvento(null); carregar(); }}
        />
      )}
      {modalHistorico && (
        <ModalHistorico
          patrimonio={modalHistorico}
          onFechar={() => setModalHistorico(null)}
        />
      )}
    </>
  );
}
