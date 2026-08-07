// src/components/EscalaCampo/MiniMapaVisita.jsx
// Mapa discreto (preview, não-interativo) da localização de uma visita — usa
// a mesma stack (react-leaflet + L.divIcon, evita o ícone padrão quebrado do
// Leaflet com bundler) já usada em Mapa.jsx, só que estático e pequeno.
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MiniMapaVisita.css';

const pinIcon = L.divIcon({
  className: 'mmv-pin-wrap',
  html: '<span class="mmv-pin"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MiniMapaVisita({ lat, lng }) {
  if (!lat || !lng) return null;
  return (
    <div className="mmv">
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
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
