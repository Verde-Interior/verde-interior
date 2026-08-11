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

// Faz uma chamada ao Nominatim com parâmetros arbitrários (object → URLSearchParams).
async function chamarNominatim(params) {
  const p = new URLSearchParams({
    format: 'json', limit: '1', addressdetails: '1', countrycodes: 'br',
    ...params,
  });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
      headers: { 'Accept-Language': 'pt-BR' },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const hit = arr[0];
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), display_name: hit.display_name };
  } catch { return null; }
}

// Extrai número, CEP e UF de um endereço brasileiro formatado livremente.
// Ex: "Rua Castilho 392, São Paulo-SP, 04568-010"
//  → { rua: "Rua Castilho", numero: "392", cep: "04568-010", uf: "SP" }
function parsearEndereco(endereco) {
  const cep    = (endereco.match(/\b(\d{5}-?\d{3})\b/) ?? [])[1] ?? null;
  const uf     = (endereco.match(/[,\s-]([A-Z]{2})(?:[,\s]|$)/) ?? [])[1] ?? null;
  const partes = endereco.split(',')[0].trim(); // "Rua Castilho 392"
  const numM   = partes.match(/^(.*?)\s+(\d+[A-Za-z]?)$/);
  return {
    rua:    numM ? numM[1] : partes,
    numero: numM ? numM[2] : null,
    cep,
    uf,
  };
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// Geocoding via Nominatim (OpenStreetMap) — grátis, respeitar 1 req/s.
// Retorna { lat, lng, display_name } ou null se não achou.
//
// Estratégia (3 tentativas em cascata):
// 1. Busca estruturada: street (rua+número) + postalcode — mais precisa, pina
//    no número exato quando o CEP confirma a rua.
// 2. Busca estruturada sem CEP: street + city + state — fallback se o CEP
//    não estiver no banco do Nominatim.
// 3. Busca livre com endereço+bairro+cidade+UF — mesmo comportamento antigo,
//    garante compatibilidade com endereços já salvos em formato variado.
export async function geocodeEndereco({ endereco, bairro, cidade = 'São Paulo', uf: ufParam = 'SP' }) {
  if (!endereco?.trim()) return null;

  const { rua, numero, cep, uf } = parsearEndereco(endereco);
  const street = numero ? `${numero} ${rua}` : rua; // Nominatim: número antes da rua
  const state  = uf ?? ufParam;

  // 1. Estruturada com CEP
  if (cep) {
    const r = await chamarNominatim({ street, postalcode: cep });
    if (r) return r;
    await delay(1000);
  }

  // 2. Estruturada com cidade/estado
  const r2 = await chamarNominatim({ street, city: cidade, state, country: 'Brazil' });
  if (r2) return r2;
  await delay(1000);

  // 3. Busca livre (compatibilidade com endereços antigos sem número/CEP)
  const q = [endereco, bairro, cidade, state].filter(Boolean).join(', ');
  return chamarNominatim({ q });
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
