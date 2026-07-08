// src/utils/formatUtils.js — Formatações genéricas

export function formatarMoeda(v) {
  if (v == null || v === '') return null;
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDuracao(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m} min`;
}

export function formatarHora(h) {
  if (!h) return '—';
  return h.slice(0, 5);
}

// "há 3 dias", "hoje", "há 2 meses"
export function tempoRelativo(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00');
  const dias = Math.round((Date.now() - d.getTime()) / (86400 * 1000));
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses === 1) return 'há 1 mês';
  if (meses < 12) return `há ${meses} meses`;
  return `há ${Math.floor(meses / 12)} ano${Math.floor(meses / 12) > 1 ? 's' : ''}`;
}
