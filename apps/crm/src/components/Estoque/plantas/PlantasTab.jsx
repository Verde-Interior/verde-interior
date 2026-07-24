// src/components/Estoque/plantas/PlantasTab.jsx
// Lista de espécies com quantidade derivada dos patrimônios
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../Toast/Toast';
import ModalEspecie from './ModalEspecie';

const LAYOUT_KEY = 'estoque-plantas-layout';
const FILTRO_KEY = 'estoque-plantas-filtro';

export default function PlantasTab() {
  const toast = useToast();
  const [resumo,  setResumo]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState(null);
  const [busca,   setBusca]   = useState('');
  const [modalEspecie, setModalEspecie] = useState(null); // null | {} (nova) | obj (editar)
  const [ajustando, setAjustando] = useState(null); // id da espécie sendo ajustada
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [layout, setLayout] = useState(() => localStorage.getItem(LAYOUT_KEY) ?? 'lista');
  const [filtro, setFiltro] = useState(() => localStorage.getItem(FILTRO_KEY) ?? 'todos');

  useEffect(() => { localStorage.setItem(LAYOUT_KEY, layout); }, [layout]);
  useEffect(() => { localStorage.setItem(FILTRO_KEY, filtro); }, [filtro]);

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

  async function adicionarPlanta(especie) {
    setAjustando(especie.especie_id);
    const { data: qr, error: eQr } = await supabase.rpc('gerar_qr_codigo_patrimonio');
    if (eQr) { toast.erro('Erro ao gerar QR: ' + eQr.message); setAjustando(null); return; }
    const id = crypto.randomUUID();
    const { error: ePat } = await supabase.from('estoque_patrimonios').insert({
      id, qr_codigo: qr, especie_id: especie.especie_id, status: 'disponivel',
    });
    if (ePat) { toast.erro('Erro: ' + ePat.message); setAjustando(null); return; }
    await supabase.from('estoque_eventos').insert({
      patrimonio_id: id,
      tipo: 'cadastro',
      especie_nova_id: especie.especie_id,
      observacoes: `Adicionado via aba Plantas — ${qr}`,
    });
    toast.ok(`+1 ${especie.nome} (${qr})`);
    setAjustando(null);
    carregar();
  }

  async function removerPlanta(especie) {
    if (especie.disponiveis <= 0) {
      toast.erro('Sem plantas disponíveis para remover.');
      return;
    }
    if (!window.confirm(`Descartar 1 planta de ${especie.nome}? Isso marca o patrimônio mais recente como descartado.`)) return;
    setAjustando(especie.especie_id);
    // pega o patrimônio disponível mais recente
    const { data: pats } = await supabase
      .from('estoque_patrimonios')
      .select('id, qr_codigo')
      .eq('especie_id', especie.especie_id)
      .eq('status', 'disponivel')
      .order('criado_em', { ascending: false })
      .limit(1);
    if (!pats?.length) { toast.erro('Nenhum disponível.'); setAjustando(null); return; }
    const p = pats[0];
    await supabase.from('estoque_patrimonios').update({ status: 'descartado' }).eq('id', p.id);
    await supabase.from('estoque_eventos').insert({
      patrimonio_id: p.id, tipo: 'descarte', observacoes: 'Descarte via aba Plantas',
    });
    toast.ok(`−1 ${especie.nome} (${p.qr_codigo} descartado)`);
    setAjustando(null);
    carregar();
  }

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return resumo.filter(e => {
      if (q && !e.nome.toLowerCase().includes(q)) return false;
      if (filtro === 'zerado'      && Number(e.total_ativos)   > 0) return false;
      if (filtro === 'baixo'       && (Number(e.disponiveis)   > 3 || Number(e.disponiveis) === 0)) return false;
      if (filtro === 'disponiveis' && Number(e.disponiveis)   === 0) return false;
      if (filtro === 'em_cliente'  && Number(e.em_cliente)    === 0) return false;
      if (filtro === 'em_evento'   && Number(e.em_evento)     === 0) return false;
      if (filtro === 'em_manut'    && Number(e.em_manutencao) === 0) return false;
      return true;
    });
  }, [resumo, busca, filtro]);

  const kpis = useMemo(() => ({
    especies:   resumo.length,
    total:      resumo.reduce((s, e) => s + Number(e.total_ativos), 0),
    disponivel: resumo.reduce((s, e) => s + Number(e.disponiveis), 0),
    em_cliente: resumo.reduce((s, e) => s + Number(e.em_cliente), 0),
  }), [resumo]);

  const filtrosDisponiveis = [
    { id: 'todos',       label: 'Todos' },
    { id: 'disponiveis', label: 'Disponíveis' },
    { id: 'baixo',       label: '⚠ Estoque baixo (1-3)' },
    { id: 'zerado',      label: 'Zerados' },
    { id: 'em_cliente',  label: 'No cliente' },
    { id: 'em_evento',   label: 'Em evento' },
    { id: 'em_manut',    label: 'Em recuperação' },
  ];

  return (
    <>
      <div className="es__kpis">
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.especies}</span>
          <span className="es__kpi-label">Espécies</span>
        </div>
        <div className="es__kpi">
          <span className="es__kpi-valor">{kpis.total}</span>
          <span className="es__kpi-label">Total</span>
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

        <button
          className={`es__btn-sec ${filtro !== 'todos' ? 'es__btn-sec--ativo' : ''}`}
          onClick={() => setFiltrosAbertos(v => !v)}
          title="Filtros"
        >
          ⚗ Filtros{filtro !== 'todos' ? ' •' : ''}
        </button>

        <div className="es__layout-toggle" role="group" aria-label="Layout">
          <button
            className={`es__layout-btn ${layout === 'lista' ? 'es__layout-btn--ativo' : ''}`}
            onClick={() => setLayout('lista')}
            title="Lista"
            aria-label="Ver como lista"
          >☰</button>
          <button
            className={`es__layout-btn ${layout === 'grid' ? 'es__layout-btn--ativo' : ''}`}
            onClick={() => setLayout('grid')}
            title="Cards"
            aria-label="Ver como grade"
          >▦</button>
        </div>

        <span className="es__count">{filtrados.length}</span>
        <button className="es__btn-pri" onClick={() => setModalEspecie({})}>+ Espécie</button>
      </div>

      {filtrosAbertos && (
        <div className="es__filtros-painel">
          <div className="es__filtros-grupo">
            <span className="es__filtros-titulo">Estado</span>
            <div className="es__filtros-pills">
              {filtrosDisponiveis.map(f => (
                <button key={f.id}
                  className={`es__pill ${filtro === f.id ? 'es__pill--ativo' : ''}`}
                  onClick={() => setFiltro(f.id)}
                >{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

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
        <div className={`es__lista es__lista--${layout}`}>
          {filtrados.map(e => (
            <div
              key={e.especie_id}
              className={`ep-card ep-card--${layout}`}
              onClick={() => setModalEspecie({ id: e.especie_id, nome: e.nome, categoria: e.categoria })}
              role="button"
              tabIndex={0}
              onKeyDown={ev => (ev.key === 'Enter' || ev.key === ' ') && setModalEspecie({ id: e.especie_id, nome: e.nome, categoria: e.categoria })}
            >
              <div className="ep-card__topo">
                <div className="ep-card__nome">{e.nome}</div>
                <div className="ep-card__saldo">{e.total_ativos}</div>
              </div>
              <div className="ep-card__acoes" onClick={ev => ev.stopPropagation()}>
                <button
                  className="ep-card__btn"
                  onClick={() => removerPlanta(e)}
                  disabled={ajustando === e.especie_id || e.disponiveis <= 0}
                  aria-label="Descartar 1"
                  title="Descartar 1 disponível"
                >−</button>
                <button
                  className="ep-card__btn ep-card__btn--add"
                  onClick={() => adicionarPlanta(e)}
                  disabled={ajustando === e.especie_id}
                  aria-label="Adicionar 1"
                  title="Gerar novo QR + planta"
                >+</button>
              </div>
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
