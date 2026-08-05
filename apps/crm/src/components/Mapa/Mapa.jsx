// src/components/Mapa/Mapa.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { supabase } from '../../lib/supabase';
import SugestoesDropdown from '../SugestoesDropdown/SugestoesDropdown';
import './Mapa.css';

const CENTRO_SP = [-23.5614, -46.6558];

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

export default function Mapa() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('todos');
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [indiceSugestao,   setIndiceSugestao]   = useState(0);
  const [alvo, setAlvo] = useState(null); // { cliente, ts } — cliente focado via dropdown

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

  return (
    <div className="mapa">
      <header className="mapa__header">
        <div className="mapa__header-topo">
          <div>
            <h2 className="mapa__titulo">Mapa de Clientes</h2>
            <p className="mapa__subtitulo">Localização dos clientes ativos · {filtrados.length} no mapa</p>
          </div>
        </div>
        <div className="mapa__filtros">
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
        </div>
      </header>

      <div className="mapa__area">
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
            <ClusterLayer clientes={filtrados} />
            <FitBounds pontos={clientes} />
            <FocoCliente alvo={alvo} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
