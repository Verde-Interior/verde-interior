// src/components/Estoque/plantas/PlantasTab.jsx
// Lista de espécies com quantidade derivada dos patrimônios
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import ModalEspecie from './ModalEspecie';

export default function PlantasTab() {
  const [resumo,  setResumo]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);
  const [busca,   setBusca]   = useState('');
  const [modalEspecie, setModalEspecie] = useState(null); // null | {} (nova) | obj (editar)

  async function carregar() {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from('estoque_especies_resumo')
      .select('*')
      .order('nome');
    setLoading(false);
    if (error) { setErro(error.message); return; }
    setResumo(data ?? []);
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return q ? resumo.filter(e => e.nome.toLowerCase().includes(q)) : resumo;
  }, [resumo, busca]);

  const kpis = useMemo(() => ({
    especies:   resumo.length,
    total:      resumo.reduce((s, e) => s + Number(e.total_ativos), 0),
    disponivel: resumo.reduce((s, e) => s + Number(e.disponiveis), 0),
    em_cliente: resumo.reduce((s, e) => s + Number(e.em_cliente), 0),
  }), [resumo]);

  return (
    <>
      <div className="es__kpis">
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.especies}</span>
          <span className="es__kpi-label">Espécies</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.total}</span>
          <span className="es__kpi-label">Total de plantas</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.disponivel}</span>
          <span className="es__kpi-label">Disponíveis</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.em_cliente}</span>
          <span className="es__kpi-label">No cliente</span>
        </div>
      </div>

      <div className="es__filtros">
        <div className="es__busca-wrap">
          <span className="es__busca-icon">⌕</span>
          <input
            className="es__busca"
            placeholder="Buscar espécie..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && <button className="es__busca-clear" onClick={() => setBusca('')}>✕</button>}
        </div>
        <span className="es__count">{filtrados.length} espécie{filtrados.length !== 1 ? 's' : ''}</span>
        <button className="es__btn-pri" onClick={() => setModalEspecie({})}>+ Nova espécie</button>
      </div>

      {loading ? (
        <div className="es__estado"><div className="es__spinner" /><p>Carregando plantas...</p></div>
      ) : erro ? (
        <div className="es__estado es__estado--erro">
          <p>Erro: {erro}</p>
          <button className="es__btn-sec" onClick={carregar}>Tentar novamente</button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="es__estado">
          <p className="es__estado-msg">{resumo.length === 0 ? 'Nenhuma espécie cadastrada.' : 'Nenhuma espécie encontrada.'}</p>
        </div>
      ) : (
        <div className="es__lista">
          {filtrados.map(e => (
            <div key={e.especie_id} className="es-card ep-especie-card">
              <div className="es-card__info">
                <div className="es-card__nome">{e.nome}</div>
                <div className="es-card__meta">
                  {e.disponiveis > 0   && <span className="ep-cnt ep-cnt--verde">{e.disponiveis} disponível{e.disponiveis !== 1 ? 'is' : ''}</span>}
                  {e.em_cliente > 0    && <span className="ep-cnt ep-cnt--azul">{e.em_cliente} no cliente</span>}
                  {e.em_manutencao > 0 && <span className="ep-cnt ep-cnt--amarelo">{e.em_manutencao} em manutenção</span>}
                  {e.descartados > 0   && <span className="ep-cnt ep-cnt--cinza">{e.descartados} descartado{e.descartados !== 1 ? 's' : ''}</span>}
                </div>
              </div>
              <div className="es-card__saldo es-card__saldo--ok">
                <span className="es-card__saldo-val">{e.total_ativos}</span>
                <span className="es-card__saldo-un">un</span>
              </div>
              <button
                className="es-card__editar"
                onClick={() => setModalEspecie({ id: e.especie_id, nome: e.nome, categoria: e.categoria })}
                title="Editar espécie"
              >✏</button>
            </div>
          ))}
        </div>
      )}

      {modalEspecie && (
        <ModalEspecie
          especie={modalEspecie.id ? modalEspecie : null}
          onFechar={() => setModalEspecie(null)}
          onSalvo={carregar}
        />
      )}
    </>
  );
}
