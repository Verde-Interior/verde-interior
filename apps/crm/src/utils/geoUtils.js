// src/utils/geoUtils.js — Funções geográficas compartilhadas pelo CRM

// Distância Haversine em km entre duas coordenadas.
// Retorna Infinity se algum ponto não tiver coordenadas válidas.
export function distanciaKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const R = 6371;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distância Haversine em metros — útil para verificações locais (ex: check-in
// próximo do endereço cadastrado).
export function distanciaMetros(lat1, lng1, lat2, lng2) {
  const km = distanciaKm(lat1, lng1, lat2, lng2);
  return km === Infinity ? null : Math.round(km * 1000);
}
