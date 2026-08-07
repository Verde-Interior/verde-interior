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

// Extrai só os 2 primeiros pedaços do endereço completo (geralmente rua +
// número), pra exibição compacta em cards — sem bairro/cidade/CEP/país.
export function enderecoSimplificado(endereco) {
  if (!endereco) return null;
  const partes = endereco.split(',').map(p => p.trim()).filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0];
  return `${partes[0]}, ${partes[1]}`;
}

// Uma chamada ao Nominatim — usado internamente por geocodeEndereco (2
// tentativas). countrycodes=br já restringe ao Brasil, não precisa repetir
// "Brasil" no texto da busca (só some espaço útil e pode até atrapalhar).
async function buscarNominatim(query) {
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR' },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const hit = arr[0];
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      display_name: hit.display_name,
    };
  } catch {
    return null;
  }
}

// Geocoding via Nominatim (OpenStreetMap) — grátis, respeitar 1 req/s.
// Retorna { lat, lng, display_name } ou null se não achou.
//
// Duas tentativas, porque o "endereco" recebido varia de lugar pra lugar no
// app: às vezes já vem completo (rua+bairro+cidade+UF+CEP, como o cadastro
// de cliente formata), às vezes é só "Rua X, 64" digitado corrido, sem
// cidade nenhuma. Tentar sempre com cidade/UF grudados quebra o primeiro
// caso (duplica e confunde a busca); nunca tentar quebra o segundo (Nominatim
// não acha uma rua sem nenhuma pista de região). Por isso: tenta cru primeiro
// (resolve o caso "já está completo" com precisão), só complementa com
// cidade/UF se a primeira tentativa não achar nada.
export async function geocodeEndereco({ endereco, bairro, cidade = 'São Paulo', uf = 'SP' }) {
  if (!endereco?.trim()) return null;

  const bruto = [endereco, bairro].filter(Boolean).join(', ');
  const resultadoBruto = await buscarNominatim(bruto);
  if (resultadoBruto) return resultadoBruto;

  await new Promise(resolve => setTimeout(resolve, 1000)); // respeita o limite de ~1 req/s do Nominatim antes de tentar de novo

  const completo = [endereco, bairro, cidade, uf].filter(Boolean).join(', ');
  return buscarNominatim(completo);
}

// Reverse geocoding via Nominatim (OpenStreetMap) — free, sem chave de API.
// Retorna "Rua, número — bairro" a partir de lat/lng, ou null se não achou.
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    const a = data?.address;
    if (!a) return data?.display_name ?? null;
    const rua    = a.road || a.pedestrian || a.footway || a.residential || '';
    const num    = a.house_number || '';
    const bairro = a.suburb || a.neighbourhood || a.city_district || '';
    if (!rua && !bairro) return data.display_name ?? null;
    let out = rua;
    if (num) out += `, ${num}`;
    if (bairro) out += out ? ` — ${bairro}` : bairro;
    return out || data.display_name || null;
  } catch { return null; }
}
