// src/components/Clientes/ClienteMapaPicker.jsx
// Mapa com pino arrastável para confirmar/corrigir visualmente a coordenada
// de um cliente. O geocoder (Nominatim) às vezes erra em vias longas — o
// gestor vê onde ele apontou e ajusta com o dedo/mouse antes de salvar,
// em vez de confiar cegamente no número calculado.
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ClienteMapaPicker.css';

const CENTRO_SP = [-23.5505, -46.6333];

const pinIcon = L.divIcon({
  className: 'cmp-pin-wrap',
  html: '<span class="cmp-pin"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

// Recentraliza o mapa sem remontar o MapContainer (que resetaria zoom/pan) —
// dispara em qualquer mudança de posição, seja por drag do pino, clique no
// mapa ou preenchimento pelo botão "Buscar coordenadas".
function Recentralizar({ posicao }) {
  const map = useMap();
  useEffect(() => {
    if (posicao) map.setView(posicao, map.getZoom());
  }, [posicao?.[0], posicao?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function CliqueParaMarcar({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function ClienteMapaPicker({ lat, lng, onChange }) {
  const latN = Number(lat);
  const lngN = Number(lng);
  const posicao = Number.isFinite(latN) && Number.isFinite(lngN) && lat !== '' && lng !== ''
    ? [latN, lngN]
    : null;

  return (
    <div className="cmp">
      <MapContainer
        center={posicao ?? CENTRO_SP}
        zoom={posicao ? 17 : 11}
        className="cmp__map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Recentralizar posicao={posicao} />
        <CliqueParaMarcar onPick={onChange} />
        {posicao && (
          <Marker
            position={posicao}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onChange(p.lat, p.lng);
              },
            }}
          />
        )}
      </MapContainer>
      <p className="cmp__dica">
        {posicao
          ? 'Arraste o pino ou clique no mapa para corrigir a posição exata.'
          : 'Busque as coordenadas do endereço ou clique no mapa para marcar a posição.'}
      </p>
    </div>
  );
}
