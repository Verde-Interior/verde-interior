// Testes das funções puras de cálculo de horas.
// Rodar: npm test
//
// calcWork e calcWorkClosed são o CORAÇÃO do sistema — se essas
// funções regridem, todo o banco de horas fica errado.
// Vale a pena ter cobertura mínima delas.

import { describe, it, expect } from 'vitest';
import { calcWorkClosed, HM, esc } from './utils.js';

describe('calcWorkClosed', () => {
  it('retorna 0 quando não há registros', () => {
    expect(calcWorkClosed([])).toBe(0);
  });

  it('conta só entry→exit sem intervalo (jornada corrida)', () => {
    const recs = [
      { type: 'entry', time: '08:00' },
      { type: 'exit',  time: '17:00' },
    ];
    expect(calcWorkClosed(recs)).toBe(9 * 60); // 9h
  });

  it('desconta intervalo quando o fluxo completo está fechado', () => {
    const recs = [
      { type: 'entry',  time: '08:00' },
      { type: 'break',  time: '12:00' },
      { type: 'return', time: '13:00' },
      { type: 'exit',   time: '17:00' },
    ];
    expect(calcWorkClosed(recs)).toBe(8 * 60); // 8h (9 - 1 de almoço)
  });

  it('ignora entrada aberta (sem exit) — só conta trechos fechados', () => {
    const recs = [
      { type: 'entry', time: '08:00' },
      // sem exit
    ];
    expect(calcWorkClosed(recs)).toBe(0);
  });

  it('lida com jornada parcial: fechou o intervalo mas ainda não saiu', () => {
    const recs = [
      { type: 'entry',  time: '08:00' },
      { type: 'break',  time: '12:00' },
      { type: 'return', time: '13:00' },
      // sem exit — período pós-return está aberto
    ];
    expect(calcWorkClosed(recs)).toBe(4 * 60); // 4h (só o trecho fechado)
  });
});

describe('HM (minutos → h:mm)', () => {
  it('formata positivo', () => {
    expect(HM(90)).toBe('1h30');
    expect(HM(0)).toBe('0h00');
    expect(HM(480)).toBe('8h00');
  });

  it('formata negativo com sinal', () => {
    expect(HM(-30)).toBe('-0h30');
    expect(HM(-125)).toBe('-2h05');
  });
});

describe('esc (XSS escape)', () => {
  it('escapa caracteres perigosos', () => {
    expect(esc('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapa aspas e apóstrofos', () => {
    expect(esc(`"'"`)).toBe('&quot;&#39;&quot;');
  });

  it('escapa & antes dos outros (evita dupla escape)', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('retorna string vazia para null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});
