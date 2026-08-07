// src/components/EscalaCampo/MiniMapaVisita.jsx
// Mapa discreto (preview) da localização de uma visita — usa a mesma stack
// (react-leaflet + L.divIcon, evita o ícone padrão quebrado do Leaflet com
// bundler) já usada em Mapa.jsx. A prévia continua pequena e sem arrastar/
// zoom por scroll (evita brigar com o scroll do modal), mas tem botões de
// zoom e um botão "expandir" que abre o mesmo mapa bem maior e totalmente
// interativo.
import { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useOverlayClose } from '../../hooks/useOverlayClose';
import './MiniMapaVisita.css';

const pinIcon = L.divIcon({
  className: 'mmv-pin-wrap',
  html: '<span class="mmv-pin"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MiniMapaVisita({ lat, lng }) {
  const [expandido, setExpandido] = useState(false);
  const overlayClose = useOverlayClose(() => setExpandido(false));

  if (!lat || !lng) return null;

  return (
    <>
      <div className="mmv">
        <button className="mmv__expandir" onClick={() => setExpandido(true)} title="Ver mapa maior">
          ⤢
        </button>
        {/* key força remontar o mapa quando a coordenada muda — MapContainer só
            usa `center` na primeira renderização, mudar o prop depois não move
            o mapa sozinho (limitação conhecida do react-leaflet). */}
        <MapContainer
          key={`${lat},${lng}`}
          center={[lat, lng]}
          zoom={15}
          className="mmv__map"
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[lat, lng]} icon={pinIcon} />
        </MapContainer>
      </div>

      {expandido && (
        <div className="ec-overlay" {...overlayClose}>
          <div className="ec-modal mmv__modal">
            <header className="ec-modal__header">
              <h3 className="ec-modal__titulo">Localização</h3>
              <button className="ec-modal__fechar" onClick={() => setExpandido(false)}>✕</button>
            </header>
            <div className="mmv__modal-corpo">
              <MapContainer
                key={`grande-${lat},${lng}`}
                center={[lat, lng]}
                zoom={16}
                className="mmv__map-grande"
                dragging={true}
                scrollWheelZoom={true}
                doubleClickZoom={true}
                touchZoom={true}
                zoomControl={true}
                attributionControl={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Marker position={[lat, lng]} icon={pinIcon} />
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
