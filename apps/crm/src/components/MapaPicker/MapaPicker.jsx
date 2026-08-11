// src/components/MapaPicker/MapaPicker.jsx
// Mapa com pino arrastável para confirmar/corrigir visualmente uma coordenada
// (cliente ou lead). O geocoder (Nominatim) às vezes erra em vias longas — o
// gestor vê onde ele apontou e ajusta com o dedo/mouse antes de salvar, em
// vez de confiar cegamente no número calculado. Também serve pra marcar a
// posição na mão quando só se tem o endereço e o geocoder não acha nada.
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaPicker.css';

const CENTRO_SP = [-23.5505, -46.6333];

const pinIcon = L.divIcon({
  className: 'mpk-pin-wrap',
  html: '<span class="mpk-pin"></span>',
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

export default function MapaPicker({ lat, lng, onChange }) {
  const latN = Number(lat);
  const lngN = Number(lng);
  const posicao = Number.isFinite(latN) && Number.isFinite(lngN) && lat !== '' && lng !== ''
    ? [latN, lngN]
    : null;

  return (
    <div className="mpk">
      <MapContainer
        center={posicao ?? CENTRO_SP}
        zoom={posicao ? 17 : 11}
        className="mpk__map"
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
      <p className="mpk__dica">
        {posicao
          ? 'Arraste o pino ou clique no mapa para corrigir a posição exata.'
          : 'Busque as coordenadas do endereço ou clique no mapa para marcar a posição.'}
      </p>
    </div>
  );
}
