// src/utils/otimizadorRota.test.js
import { describe, it, expect } from 'vitest';
import {
  horaEmMinutos, minutosParaHora, simularOrdem,
  otimizarRotaNN, otimizarRotaComRestricoes,
} from './otimizadorRota';

describe('horaEmMinutos', () => {
  it('converte HH:MM em minutos totais', () => {
    expect(horaEmMinutos('07:00')).toBe(420);
    expect(horaEmMinutos('13:30')).toBe(810);
    expect(horaEmMinutos('00:00')).toBe(0);
  });
  it('lida com HH:MM:SS truncando os segundos', () => {
    expect(horaEmMinutos('09:15:45')).toBe(555);
  });
  it('retorna null para entrada vazia', () => {
    expect(horaEmMinutos(null)).toBeNull();
    expect(horaEmMinutos('')).toBeNull();
  });
});

describe('minutosParaHora', () => {
  it('converte minutos totais em HH:MM com padding', () => {
    expect(minutosParaHora(420)).toBe('07:00');
    expect(minutosParaHora(0)).toBe('00:00');
    expect(minutosParaHora(75)).toBe('01:15');
  });
});

describe('otimizarRotaNN — nearest neighbor', () => {
  const visitaAt = (id, lat, lng, hora = null) => ({
    id, hora_estimada_chegada: hora,
    clientes: { lat, lng },
  });

  it('retorna vazio para menos de 2 visitas', () => {
    expect(otimizarRotaNN([])).toEqual([]);
    expect(otimizarRotaNN([visitaAt('a', 0, 0)])).toEqual([]);
  });

  it('começa pela visita com hora fixa mais cedo', () => {
    const v1 = visitaAt('a', -23.55, -46.63);
    const v2 = visitaAt('b', -23.56, -46.64, '08:00');
    const v3 = visitaAt('c', -23.57, -46.65, '10:00');
    const ordem = otimizarRotaNN([v1, v2, v3]);
    expect(ordem[0].id).toBe('b'); // 08:00 vem antes de 10:00
  });

  it('sem hora fixa, começa pela primeira do array', () => {
    const v1 = visitaAt('a', -23.55, -46.63);
    const v2 = visitaAt('b', -23.56, -46.64);
    const ordem = otimizarRotaNN([v1, v2]);
    expect(ordem[0].id).toBe('a');
  });
});

describe('simularOrdem — score de rota', () => {
  const visita = (id, lat, lng, extras = {}) => ({
    id, clientes: { lat, lng, ...(extras.clientes ?? {}) },
    ...extras,
  });

  it('rota sem restrições — score = distância', () => {
    // 2 visitas próximas, sem janela → sem violação, sem espera
    const v1 = visita('a', -23.55, -46.63);
    const v2 = visita('b', -23.551, -46.631);
    const r = simularOrdem([v1, v2]);
    expect(r.temViolacao).toBe(false);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBe(r.distTotalKm); // sem penalidades
  });

  it('violação de janela do cliente adiciona penalidade dominante', () => {
    // Primeira visita começa às 07:00, dura 60min, chega na segunda ~7:14
    // Segunda tem janela que fecha às 07:10 (violação de 4min)
    const v1 = visita('a', -23.55, -46.63, {
      hora_estimada_chegada: '07:00',
      duracao_estimada_min: 60,
    });
    const v2 = visita('b', -23.551, -46.631, {
      clientes: { janela_entrada_fim: '07:10' },
    });
    const r = simularOrdem([v1, v2]);
    expect(r.temViolacao).toBe(true);
    expect(r.score).toBeGreaterThan(500); // penalidade base de 500 + minutos
  });
});

describe('otimizarRotaComRestricoes — brute-force com fallback', () => {
  it('retorna null para menos de 2 visitas', () => {
    expect(otimizarRotaComRestricoes([])).toBeNull();
    expect(otimizarRotaComRestricoes([{ id: 'a', clientes: { lat: 0, lng: 0 } }])).toBeNull();
  });

  it('sem restrição de janela — segue rota geográfica', () => {
    const v1 = { id: 'a', clientes: { lat: -23.55, lng: -46.63 } };
    const v2 = { id: 'b', clientes: { lat: -23.60, lng: -46.70 } }; // longe
    const v3 = { id: 'c', clientes: { lat: -23.551, lng: -46.631 } }; // colado no v1
    const r = otimizarRotaComRestricoes([v1, v2, v3]);
    // Sem janelas, deve retornar rota geográfica (a → c → b)
    expect(r.iguais).toBe(true);
    expect(r.ordem[0].id).toBe('a');
  });
});
