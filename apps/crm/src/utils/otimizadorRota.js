// src/utils/otimizadorRota.js
// Otimização de rota de visitas com restrições de janela do cliente.
// Extraído de EscalaCampo.jsx para permitir testes isolados.

import { distanciaKm } from './geoUtils';

// ── Parâmetros ──────────────────────────────────────────────────────────
export const VEL_MEDIA_KMH           = 15;   // velocidade média em SP (a pé + público)
export const SETUP_MIN_ENTRE_VISITAS = 10;   // parar, encontrar contato, iniciar
export const LIMITE_BRUTE_FORCE      = 9;    // acima disso, fallback para nearest-neighbor
export const HORA_INICIO_DEFAULT     = 7 * 60; // 07:00 se ninguém tem hora ou janela

// ── Helpers de tempo ────────────────────────────────────────────────────
export function horaEmMinutos(h) {
  if (!h) return null;
  const [hh, mm] = h.slice(0, 5).split(':').map(Number);
  return hh * 60 + mm;
}

export function minutosParaHora(m) {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

// Gera todas as permutações de um array (Heap's algorithm iterativo)
export function* permutacoes(arr) {
  const n = arr.length;
  const c = new Array(n).fill(0);
  yield arr.slice();
  let i = 1;
  while (i < n) {
    if (c[i] < i) {
      const k = i % 2 === 0 ? 0 : c[i];
      [arr[k], arr[i]] = [arr[i], arr[k]];
      yield arr.slice();
      c[i] += 1;
      i = 1;
    } else {
      c[i] = 0;
      i += 1;
    }
  }
}

// Simula a linha do tempo de uma ordem específica e calcula score + timeline
// Regras:
//  - Distância é o objetivo principal (soma direto no score)
//  - Espera (chegar antes da janela abrir) tem penalidade LEVE — aceitável
//  - Violação de janela do cliente (chegar depois de janela_entrada_fim)
//    tem penalidade DOMINANTE — só isso justifica sair da rota mais curta
export function simularOrdem(ordem, _opts = {}) {
  const km_totais = [];
  const timeline = [];
  let penalidadeEspera = 0;
  let penalidadeViolacao = 0;

  const primeiro = ordem[0];
  const janIni = primeiro.clientes?.janela_entrada_inicio
    ? horaEmMinutos(primeiro.clientes.janela_entrada_inicio) : null;
  // O otimizador SEMPRE começa no horário mais cedo possível — não respeita
  // a hora_estimada_chegada que porventura já esteja na visita (essa hora
  // pode ter sido setada errado antes). Preferência:
  //   janela_entrada_inicio do cliente (se existir) > HORA_INICIO_DEFAULT (07:00)
  // Assim, cliente que aceita a partir das 08:00 → 1ª visita fica 08:00,
  // não 08:30 (que é o limite fim, não o início).
  let tempoAtual = janIni != null && janIni > HORA_INICIO_DEFAULT
    ? janIni
    : HORA_INICIO_DEFAULT;

  for (let i = 0; i < ordem.length; i++) {
    const v = ordem[i];
    if (i > 0) {
      const prev = ordem[i - 1];
      let kmParaCa = distanciaKm(prev.clientes?.lat, prev.clientes?.lng, v.clientes?.lat, v.clientes?.lng);
      if (!isFinite(kmParaCa)) kmParaCa = 0;
      km_totais.push(kmParaCa);
      const minDeslocamento = Math.round((kmParaCa / VEL_MEDIA_KMH) * 60) + SETUP_MIN_ENTRE_VISITAS;
      tempoAtual += minDeslocamento;
    }

    const jIni = v.clientes?.janela_entrada_inicio ? horaEmMinutos(v.clientes.janela_entrada_inicio) : null;
    const jFim = v.clientes?.janela_entrada_fim    ? horaEmMinutos(v.clientes.janela_entrada_fim)    : null;

    let esperaMin = 0;
    let violacaoMin = 0;

    if (jIni != null && tempoAtual < jIni) {
      esperaMin = jIni - tempoAtual;
      tempoAtual = jIni;
    }
    if (jFim != null && tempoAtual > jFim) {
      violacaoMin = tempoAtual - jFim;
    }

    penalidadeEspera += esperaMin * 0.05;
    if (violacaoMin > 0) penalidadeViolacao += 500 + violacaoMin * 20;

    const chegada = tempoAtual;
    const duracao = v.duracao_estimada_min ?? v.clientes?.duracao_estimada_min ?? 60;
    tempoAtual += duracao;
    const saida = tempoAtual;

    timeline.push({ visitaId: v.id, chegada, saida, esperaMin, atrasoMin: 0, violacaoMin });
  }

  const distTotalKm = km_totais.reduce((s, x) => s + x, 0);
  const score = distTotalKm + penalidadeEspera + penalidadeViolacao;
  return { score, distTotalKm, timeline, temViolacao: penalidadeViolacao > 0 };
}

// Nearest-neighbor a partir da primeira visita (ou primeira com hora)
export function otimizarRotaNN(visitas) {
  if (visitas.length < 2) return [];
  const comHora = visitas.filter(v => v.hora_estimada_chegada);
  const start = comHora.length
    ? comHora.sort((a, b) => a.hora_estimada_chegada.localeCompare(b.hora_estimada_chegada))[0]
    : visitas[0];

  const restantes = new Set(visitas.map(v => v.id));
  const ordem = [];
  let atual = start;
  restantes.delete(atual.id);
  ordem.push(atual);
  while (restantes.size) {
    let melhor = null;
    let melhorDist = Infinity;
    for (const id of restantes) {
      const v = visitas.find(x => x.id === id);
      const d = distanciaKm(atual.clientes?.lat, atual.clientes?.lng, v.clientes?.lat, v.clientes?.lng);
      if (d < melhorDist) { melhorDist = d; melhor = v; }
    }
    if (!melhor) break;
    ordem.push(melhor);
    restantes.delete(melhor.id);
    atual = melhor;
  }
  return ordem;
}

// Otimizador com restrições de janela — brute-force para N ≤ LIMITE_BRUTE_FORCE
// Retorna { ordem, ordemGeo, distKmViavel, distKmGeo, timeline, motivos, usouFallback }
export function otimizarRotaComRestricoes(visitas) {
  if (visitas.length < 2) return null;

  const ordemGeo = otimizarRotaNN(visitas);
  const simGeo   = simularOrdem(ordemGeo);

  if (visitas.length > LIMITE_BRUTE_FORCE) {
    return {
      ordem: ordemGeo, ordemGeo, distKmViavel: simGeo.distTotalKm,
      distKmGeo: simGeo.distTotalKm, timeline: simGeo.timeline,
      motivos: [], usouFallback: true, iguais: true,
    };
  }

  let melhor = null;
  for (const perm of permutacoes(visitas.slice())) {
    const sim = simularOrdem(perm);
    if (!melhor || sim.score < melhor.score) {
      melhor = { ordem: perm.slice(), ...sim };
    }
  }

  const posGeo = new Map(ordemGeo.map((v, i) => [v.id, i]));
  const iguais = melhor.ordem.every((v, i) => ordemGeo[i]?.id === v.id);

  const motivos = [];
  if (!iguais) {
    melhor.ordem.forEach((v, iMel) => {
      const iGeo = posGeo.get(v.id);
      if (iGeo == null || iGeo === iMel) return;
      const c = v.clientes ?? {};
      if (c.janela_entrada_inicio || c.janela_entrada_fim) {
        const jI = c.janela_entrada_inicio?.slice(0, 5);
        const jF = c.janela_entrada_fim?.slice(0, 5);
        let janelaTxt = '';
        if (jI && jF) janelaTxt = `só recebe entre ${jI} e ${jF}`;
        else if (jI) janelaTxt = `só recebe a partir de ${jI}`;
        else if (jF) janelaTxt = `só recebe até ${jF}`;
        motivos.push({
          visitaId: v.id,
          nome: c.nome_empresa,
          texto: `${c.nome_empresa} ${janelaTxt}`,
          moveuDe: iGeo, moveuPara: iMel,
        });
      }
    });
  }

  // Safety net: se difere da rota geográfica mas nenhum motivo justifica,
  // volta pra ordem geográfica.
  if (!iguais && motivos.length === 0) {
    return {
      ordem: ordemGeo,
      ordemGeo,
      distKmViavel: simGeo.distTotalKm,
      distKmGeo:    simGeo.distTotalKm,
      timeline:     simGeo.timeline,
      motivos:      [],
      usouFallback: false,
      iguais:       true,
      temViolacao:  simGeo.temViolacao,
    };
  }

  return {
    ordem: melhor.ordem,
    ordemGeo,
    distKmViavel: melhor.distTotalKm,
    distKmGeo:    simGeo.distTotalKm,
    timeline:     melhor.timeline,
    motivos,
    usouFallback: false,
    iguais,
    temViolacao: melhor.temViolacao,
  };
}
