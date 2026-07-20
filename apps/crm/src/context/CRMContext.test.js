// Testes smoke dos helpers do CRMContext.
// Rodar: npm test (ou npm run test:watch).
//
// Foco desses testes: garantir que os helpers puros (que não dependem
// de React/Supabase) continuam fazendo o esperado. Se algum dia
// alguém mudar getTiposServico e quebrar leads legados, o teste pega.

import { describe, it, expect } from 'vitest';
import { getTiposServico, getTipoPrimario, addDias, criarFluxoOrcamento } from './CRMContext.jsx';

describe('getTiposServico', () => {
  it('retorna array vazio se lead é null/undefined', () => {
    expect(getTiposServico(null)).toEqual([]);
    expect(getTiposServico(undefined)).toEqual([]);
  });

  it('lê tiposServico quando é array (formato novo)', () => {
    expect(getTiposServico({ tiposServico: ['manutencao', 'reforma'] }))
      .toEqual(['manutencao', 'reforma']);
  });

  it('encapsula tipoServico string legada em array (backwards-compat)', () => {
    expect(getTiposServico({ tipoServico: 'locacao' })).toEqual(['locacao']);
  });

  it('remove valores falsy do array', () => {
    expect(getTiposServico({ tiposServico: ['manutencao', null, '', 'reforma'] }))
      .toEqual(['manutencao', 'reforma']);
  });

  it('prefere tiposServico se ambos os campos existirem', () => {
    expect(getTiposServico({ tiposServico: ['reforma'], tipoServico: 'locacao' }))
      .toEqual(['reforma']);
  });
});

describe('getTipoPrimario', () => {
  it('retorna o primeiro tipo do array', () => {
    expect(getTipoPrimario({ tiposServico: ['locacao', 'manutencao'] })).toBe('locacao');
  });

  it('retorna null quando não há tipos', () => {
    expect(getTipoPrimario({})).toBeNull();
    expect(getTipoPrimario({ tiposServico: [] })).toBeNull();
  });
});

describe('addDias', () => {
  it('soma dias mantendo formato ISO (YYYY-MM-DD)', () => {
    expect(addDias('2026-07-20', 3)).toBe('2026-07-23');
  });

  it('atravessa mudança de mês', () => {
    expect(addDias('2026-07-30', 5)).toBe('2026-08-04');
  });

  it('atravessa mudança de ano', () => {
    expect(addDias('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('criarFluxoOrcamento', () => {
  it('cria fluxo com T1 de 3 dias quando não há visita agendada', () => {
    const lead = { visitas: [] };
    const fluxo = criarFluxoOrcamento(lead, '2026-07-20');
    expect(fluxo.t1.prazoDias).toBe(3);
    expect(fluxo.t1.prazoData).toBe('2026-07-23');
    expect(fluxo.etapaAtual).toBe('t1');
    expect(fluxo.ativo).toBe(true);
  });

  it('cria fluxo com T1 de 6 dias quando há visita agendada', () => {
    const lead = { visitas: [{ id: 'v-1', data: '2026-07-21' }] };
    const fluxo = criarFluxoOrcamento(lead, '2026-07-20');
    expect(fluxo.t1.prazoDias).toBe(6);
    expect(fluxo.t1.prazoData).toBe('2026-07-26');
  });

  it('T2/T3 encadeiam prazos a partir do anterior', () => {
    const fluxo = criarFluxoOrcamento({ visitas: [] }, '2026-07-20');
    expect(fluxo.t2.prazoData).toBe('2026-07-26'); // t1 + 3
    expect(fluxo.t3.prazoData).toBe('2026-07-29'); // t2 + 3
  });
});
