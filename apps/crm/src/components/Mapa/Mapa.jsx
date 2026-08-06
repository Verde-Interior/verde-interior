// src/components/Mapa/Mapa.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { supabase } from '../../lib/supabase';
import SugestoesDropdown from '../SugestoesDropdown/SugestoesDropdown';
import ModalDetalhesCliente from '../ModalDetalhesCliente/ModalDetalhesCliente';
import ModalDetalhesAgendamento from '../Dashboard/ModalDetalhesAgendamento';
import './Mapa.css';

const CENTRO_SP = [-23.5614, -46.6558];

const STATUS_COR = {
  concluido: '#10B981', em_execucao: '#3B82F6', publicado: '#F59E0B', cancelado: '#9CA3AF',
};
function corStatus(status) { return STATUS_COR[status] ?? '#9CA3AF'; }

function hojeStr() { return new Date().toISOString().split('T')[0]; }

const pinIcon = L.divIcon({
  className: 'mapa-pin-wrap',
  html: '<span class="mapa-pin"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
});

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function telefoneLimpo(tel) {
  return (tel ?? '').replace(/\D/g, '');
}

function popupHtml(c) {
  const tel = telefoneLimpo(c.contato_telefone);
  return `
    <div class="mapa-popup">
      <strong class="mapa-popup__nome">${escapeHtml(c.nome_empresa)}</strong>
      ${c.grupo_servico ? `<span class="mapa-popup__grupo">${escapeHtml(c.grupo_servico)}</span>` : ''}
      <p class="mapa-popup__endereco">📍 ${escapeHtml(c.endereco || c.bairro || '—')}${c.endereco && c.bairro ? ` — ${escapeHtml(c.bairro)}` : ''}</p>
      ${c.contato_nome ? `<p class="mapa-popup__contato">${escapeHtml(c.contato_nome)}</p>` : ''}
      ${tel ? `
        <div class="mapa-popup__acoes">
          <a href="https://wa.me/55${tel}" target="_blank" rel="noreferrer">💬 WhatsApp</a>
          <a href="tel:${tel}">📞 Ligar</a>
        </div>
      ` : ''}
      <button type="button" class="mapa-popup__abrir" data-cliente-id="${escapeHtml(c.id)}">📋 Ver cadastro completo</button>
    </div>
  `;
}

// Camada de clusters, montada imperativamente (leaflet.markercluster não tem
// wrapper oficial pra react-leaflet v4/React 18 — só existe pra v5/React 19).
function ClusterLayer({ clientes }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => L.divIcon({
        html: `<div class="mapa-cluster">${cluster.getChildCount()}</div>`,
        className: '',
        iconSize: [38, 38],
      }),
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => { map.removeLayer(group); };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    clientes.forEach((c) => {
      const marker = L.marker([c.lat, c.lng], { icon: pinIcon });
      marker.bindPopup(popupHtml(c));
      group.addLayer(marker);
    });
  }, [clientes]);

  return null;
}

// Centraliza no cliente escolhido via dropdown de sugestões e abre o popup dele.
function FocoCliente({ alvo }) {
  const map = useMap();

  useEffect(() => {
    if (!alvo) return;
    const c = alvo.cliente;
    map.flyTo([c.lat, c.lng], 16);
    L.popup().setLatLng([c.lat, c.lng]).setContent(popupHtml(c)).openOn(map);
    // alvo.ts muda a cada seleção (mesmo que seja o mesmo cliente de novo),
    // garantindo que o efeito rode de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.ts, map]);

  return null;
}

// Ouve o clique em "Ver cadastro completo" dentro de qualquer popup aberto
// (tanto os dos markers do cluster quanto o do FocoCliente) e delega pro
// callback do React — o conteúdo do popup é HTML puro do Leaflet, então a
// ponte com o app precisa ser via DOM event, não via props/onClick normal.
function PopupAcoes({ onAbrirCliente }) {
  const map = useMap();

  useEffect(() => {
    function onPopupOpen(e) {
      const btn = e.popup.getElement()?.querySelector('.mapa-popup__abrir');
      if (!btn) return;
      btn.addEventListener('click', () => {
        // Fecha o popup do Leaflet ao abrir o modal — sem isso ele continua
        // "aberto" por trás com o mesmo botão, cujo listener (once) já foi
        // consumido, e um segundo clique não faz mais nada.
        map.closePopup();
        onAbrirCliente(btn.dataset.clienteId);
      }, { once: true });
    }
    map.on('popupopen', onPopupOpen);
    return () => map.off('popupopen', onPopupOpen);
  }, [map, onAbrirCliente]);

  return null;
}

// Enquadra o mapa nos clientes carregados — só na primeira carga, pra não
// ficar recentralizando toda hora que o usuário filtra/busca.
function FitBounds({ pontos }) {
  const map = useMap();
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current || pontos.length === 0) return;
    const bounds = L.latLngBounds(pontos.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    feito.current = true;
  }, [pontos, map]);

  return null;
}

// Rota de um funcionário num dia: pino numerado (na ordem de chegada) por
// visita com localização, ligados por uma linha — em linha reta, não é rota
// de rua real (ver otimizadorRota.js, que já assume isso pra ordenar).
function RotaLayer({ visitas, onAbrirVisita }) {
  const map = useMap();
  const comGeo = useMemo(() => visitas.filter((v) => v.cliente?.lat && v.cliente?.lng), [visitas]);

  useEffect(() => {
    if (comGeo.length === 0) return;
    const bounds = L.latLngBounds(comGeo.map((v) => [v.cliente.lat, v.cliente.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [comGeo, map]);

  useEffect(() => {
    const markers = comGeo.map((v, i) => {
      const icon = L.divIcon({
        className: 'mapa-rota-pin-wrap',
        html: `<span class="mapa-rota-pin" style="background:${corStatus(v.status)}">${i + 1}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([v.cliente.lat, v.cliente.lng], { icon }).addTo(map);
      marker.on('click', () => onAbrirVisita(v));
      return marker;
    });
    return () => markers.forEach((m) => map.removeLayer(m));
  }, [comGeo, map, onAbrirVisita]);

  if (comGeo.length < 2) return null;
  return (
    <Polyline
      positions={comGeo.map((v) => [v.cliente.lat, v.cliente.lng])}
      pathOptions={{ color: '#7B1A1A', weight: 3, opacity: 0.7, dashArray: '6 8' }}
    />
  );
}

export default function Mapa({ onNavegar }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [indiceSugestao,   setIndiceSugestao]   = useState(0);
  const [alvo, setAlvo] = useState(null); // { cliente, ts } — cliente focado via dropdown
  const [detalheClienteId, setDetalheClienteId] = useState(null); // cliente com modal de detalhes aberto

  // ── Planejador de rota (Fase 1: visualizar rota de 1 funcionário/dia) ──
  const [funcionarios, setFuncionarios] = useState([]);
  const [rotaFuncionarioId, setRotaFuncionarioId] = useState('');
  const [rotaData, setRotaData] = useState(hojeStr);
  const [rotaVisitas, setRotaVisitas] = useState([]);
  const [rotaLoading, setRotaLoading] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null);
  const modoRota = rotaFuncionarioId !== '';

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, name, cargo')
        .in('cargo', ['Campo', 'Facilities', 'TI', 'Sócio/Campo'])
        .order('name');
      setFuncionarios(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!modoRota) { setRotaVisitas([]); return; }
    let cancelado = false;
    (async () => {
      setRotaLoading(true);
      const { data } = await supabase
        .from('agenda')
        .select(`
          id, data_agendada, hora_estimada_chegada, funcionario_id, status, tipos_tarefa,
          cliente:clientes(id, nome_empresa, bairro, lat, lng)
        `)
        .eq('funcionario_id', rotaFuncionarioId)
        .eq('data_agendada', rotaData)
        .order('hora_estimada_chegada', { ascending: true, nullsFirst: false });
      if (cancelado) return;
      setRotaVisitas(data ?? []);
      setRotaLoading(false);
    })();
    return () => { cancelado = true; };
  }, [modoRota, rotaFuncionarioId, rotaData]);

  const rotaFuncionarioNome = funcionarios.find((f) => String(f.id) === String(rotaFuncionarioId))?.name;
  const rotaSemGeo = rotaVisitas.filter((v) => !v.cliente?.lat || !v.cliente?.lng).length;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_empresa, endereco, bairro, lat, lng, grupo_servico, contato_nome, contato_telefone')
        .eq('ativo', true);
      setClientes((data ?? []).filter((c) => c.lat && c.lng));
      setLoading(false);
    })();
  }, []);

  const grupos = useMemo(() => {
    const set = new Set(clientes.map((c) => c.grupo_servico).filter(Boolean));
    return [...set].sort();
  }, [clientes]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return clientes.filter((c) => {
      if (filtroGrupo !== 'todos' && c.grupo_servico !== filtroGrupo) return false;
      if (q && !c.nome_empresa.toLowerCase().includes(q) && !c.bairro?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clientes, busca, filtroGrupo]);

  const sugestoes = useMemo(() => {
    if (!busca.trim()) return [];
    return filtrados.slice(0, 8).map((c) => ({ id: c.id, label: c.nome_empresa, sublabel: c.bairro, _cliente: c }));
  }, [filtrados, busca]);

  function selecionarSugestao(item) {
    setSugestoesAbertas(false);
    setBusca(item.label);
    setAlvo({ cliente: item._cliente, ts: Date.now() });
  }

  function onBuscaKeyDown(e) {
    if (!sugestoesAbertas || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSugestao((i) => Math.min(i + 1, sugestoes.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setIndiceSugestao((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); selecionarSugestao(sugestoes[indiceSugestao]); }
    else if (e.key === 'Escape')    { setSugestoesAbertas(false); }
  }

  // Abre o modal de detalhes sem sair do mapa (markers e estado do Leaflet
  // continuam montados). Só a edição de verdade ("Editar cadastro completo"
  // dentro do modal) navega pra Clientes — via deep-link, mesmo padrão do
  // ?relatorio=<id> em Relatórios.
  function irParaEdicao(clienteId) {
    window.history.pushState({}, '', `?tela=clientes&cliente=${clienteId}`);
    onNavegar?.('clientes');
  }

  return (
    <div className="mapa">
      <header className="mapa__header">
        <div className="mapa__header-topo">
          <div>
            <h2 className="mapa__titulo">Mapa de Clientes</h2>
            <p className="mapa__subtitulo">
              {modoRota
                ? `Rota de ${rotaFuncionarioNome ?? '—'} · ${new Date(rotaData + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${rotaVisitas.length} visita${rotaVisitas.length !== 1 ? 's' : ''}`
                : `Localização dos clientes ativos · ${filtrados.length} no mapa`}
            </p>
          </div>
        </div>
        <div className="mapa__filtros">
          {!modoRota && (
            <>
              <div className="mapa__busca-wrap">
                <span className="mapa__busca-icon">⌕</span>
                <input
                  className="mapa__busca"
                  placeholder="Buscar por nome ou bairro..."
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setSugestoesAbertas(true); setIndiceSugestao(0); }}
                  onFocus={() => busca.trim() && setSugestoesAbertas(true)}
                  onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
                  onKeyDown={onBuscaKeyDown}
                  autoComplete="off"
                />
                {busca && <button className="mapa__busca-limpar" onClick={() => setBusca('')}>✕</button>}
                {sugestoesAbertas && busca.trim() && (
                  <SugestoesDropdown itens={sugestoes} indiceAtivo={indiceSugestao} onSelecionar={selecionarSugestao} onHover={setIndiceSugestao} />
                )}
              </div>
              <select className="mapa__select" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
                <option value="todos">Todos os grupos</option>
                {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </>
          )}

          <select
            className="mapa__select"
            value={rotaFuncionarioId}
            onChange={(e) => setRotaFuncionarioId(e.target.value)}
          >
            <option value="">🧭 Planejar rota de...</option>
            {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {modoRota && (
            <>
              <input
                type="date"
                className="mapa__select"
                value={rotaData}
                onChange={(e) => setRotaData(e.target.value)}
              />
              <button className="mapa__rota-sair" onClick={() => setRotaFuncionarioId('')} title="Sair do modo rota">
                ✕ Ver todos os clientes
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mapa__area">
        {modoRota && (
          <aside className="mapa__rota-painel">
            <div className="mapa__rota-painel-header">
              <div className="mapa__rota-painel-titulo">Itinerário</div>
              <div className="mapa__rota-painel-sub">
                {rotaLoading ? 'Carregando...' : `${rotaVisitas.length} visita${rotaVisitas.length !== 1 ? 's' : ''}${rotaSemGeo > 0 ? ` · ${rotaSemGeo} sem localização` : ''}`}
              </div>
            </div>
            {!rotaLoading && rotaVisitas.length === 0 ? (
              <p className="mapa__rota-vazio">Nenhuma visita agendada para {rotaFuncionarioNome} nesse dia.</p>
            ) : (
              <div className="mapa__rota-lista">
                {rotaVisitas.map((v, i) => {
                  const semGeo = !v.cliente?.lat || !v.cliente?.lng;
                  return (
                    <button key={v.id} className="mapa__rota-item" onClick={() => setAgendamentoSelecionado(v)}>
                      <span className="mapa__rota-item__num" style={{ background: corStatus(v.status) }}>{i + 1}</span>
                      <span className="mapa__rota-item__info">
                        <span className="mapa__rota-item__nome">{v.cliente?.nome_empresa ?? '—'}</span>
                        <span className="mapa__rota-item__meta">{v.hora_estimada_chegada?.slice(0, 5) ?? '—'}{v.cliente?.bairro ? ` · ${v.cliente.bairro}` : ''}</span>
                        {semGeo && <span className="mapa__rota-item__semgeo">⚠ sem localização</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        )}

        <div className="mapa__mapa-wrap">
          {loading ? (
            <div className="mapa__estado">
              <div className="mapa__spinner" />
              <p>Carregando clientes...</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="mapa__estado">
              <p>Nenhum cliente ativo com localização cadastrada ainda.</p>
            </div>
          ) : (
            <MapContainer center={CENTRO_SP} zoom={11} className="mapa__leaflet">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {modoRota ? (
                <RotaLayer key={`${rotaFuncionarioId}-${rotaData}`} visitas={rotaVisitas} onAbrirVisita={setAgendamentoSelecionado} />
              ) : (
                <>
                  <ClusterLayer clientes={filtrados} />
                  <FitBounds pontos={clientes} />
                  <FocoCliente alvo={alvo} />
                  <PopupAcoes onAbrirCliente={setDetalheClienteId} />
                </>
              )}
            </MapContainer>
          )}
        </div>
      </div>

      {detalheClienteId && (
        <ModalDetalhesCliente
          clienteId={detalheClienteId}
          onFechar={() => setDetalheClienteId(null)}
          onEditar={() => irParaEdicao(detalheClienteId)}
        />
      )}

      {agendamentoSelecionado && (
        <ModalDetalhesAgendamento
          visita={agendamentoSelecionado}
          funcionarioNome={rotaFuncionarioNome}
          onFechar={() => setAgendamentoSelecionado(null)}
          onVerNaEscala={() => { setAgendamentoSelecionado(null); onNavegar?.('escala'); }}
        />
      )}
    </div>
  );
}
