// src/utils/trocaHelpers.test.js
import { describe, it, expect } from 'vitest';
import {
  calcSemanaCiclo, ehSemanaOrquidea, ultimaTrocaPorClienteMap, candidatosTroca,
} from './trocaHelpers';

describe('calcSemanaCiclo', () => {
  it('classifica pelas segundas-feiras de cada semana do mês', () => {
    // Agosto/2026: dia 1 é sábado — primeira segunda-feira do mês é 03/08.
    expect(calcSemanaCiclo('2026-08-03')).toBe(1); // segunda da semana 1
    expect(calcSemanaCiclo('2026-08-07')).toBe(1); // sexta da mesma semana
    expect(calcSemanaCiclo('2026-08-10')).toBe(2);
    expect(calcSemanaCiclo('2026-08-17')).toBe(3);
    expect(calcSemanaCiclo('2026-08-24')).toBe(4);
  });
  it('acumula a sobra do fim do mês na semana 4', () => {
    expect(calcSemanaCiclo('2026-08-31')).toBe(4);
  });
});

describe('ehSemanaOrquidea', () => {
  it('semanas 1 e 3 são de orquídea, 2 e 4 são de troca geral', () => {
    expect(ehSemanaOrquidea(1)).toBe(true);
    expect(ehSemanaOrquidea(2)).toBe(false);
    expect(ehSemanaOrquidea(3)).toBe(true);
    expect(ehSemanaOrquidea(4)).toBe(false);
  });
});

describe('ultimaTrocaPorClienteMap', () => {
  it('pega a data mais recente por cliente', () => {
    const mapa = ultimaTrocaPorClienteMap([
      { cliente_id: 'a', data_agendada: '2026-07-01', status: 'concluido' },
      { cliente_id: 'a', data_agendada: '2026-07-15', status: 'concluido' },
      { cliente_id: 'b', data_agendada: '2026-07-10', status: 'publicado' },
    ]);
    expect(mapa.get('a')).toBe('2026-07-15');
    expect(mapa.get('b')).toBe('2026-07-10');
  });
  it('ignora cancelado e faltou', () => {
    const mapa = ultimaTrocaPorClienteMap([
      { cliente_id: 'a', data_agendada: '2026-07-20', status: 'cancelado' },
      { cliente_id: 'a', data_agendada: '2026-07-01', status: 'concluido' },
    ]);
    expect(mapa.get('a')).toBe('2026-07-01');
  });
  it('ignora linhas sem cliente_id (tarefa avulsa/lead)', () => {
    const mapa = ultimaTrocaPorClienteMap([
      { cliente_id: null, data_agendada: '2026-07-20', status: 'concluido' },
    ]);
    expect(mapa.size).toBe(0);
  });
});

describe('candidatosTroca', () => {
  const base = {
    hojeIso: '2026-08-03', // semana 1 (orquídea)
    ultimaTrocaPorCliente: new Map(),
  };

  it('semana de orquídea só pega quem tem tem_orquidea', () => {
    const clientes = [
      { id: 'a', tem_orquidea: true,  grupo_servico: 'Manutenção' },
      { id: 'b', tem_orquidea: false, grupo_servico: 'Manutenção com troca' },
    ];
    const out = candidatosTroca({ ...base, clientes, semanaCiclo: 1 });
    expect(out.map(c => c.id)).toEqual(['a']);
  });

  it('semana de troca geral pega "Manutenção com troca" e "Locação"', () => {
    const clientes = [
      { id: 'a', tem_orquidea: true,  grupo_servico: 'Manutenção' },
      { id: 'b', tem_orquidea: false, grupo_servico: 'Manutenção com troca' },
      { id: 'c', tem_orquidea: false, grupo_servico: 'Locação' },
      { id: 'd', tem_orquidea: false, grupo_servico: 'Pontual' },
    ];
    const out = candidatosTroca({ ...base, clientes, semanaCiclo: 2 });
    expect(out.map(c => c.id).sort()).toEqual(['b', 'c']);
  });

  it('ordena por quem está há mais tempo sem trocar; nunca trocou vem primeiro', () => {
    const clientes = [
      { id: 'a', tem_orquidea: true, grupo_servico: 'Manutenção' },
      { id: 'b', tem_orquidea: true, grupo_servico: 'Manutenção' },
      { id: 'c', tem_orquidea: true, grupo_servico: 'Manutenção' },
    ];
    const ultimaTrocaPorCliente = new Map([
      ['a', '2026-07-20'], // há pouco tempo
      ['b', '2026-06-01'], // há muito tempo
      // 'c' nunca trocou — deve vir primeiro
    ]);
    const out = candidatosTroca({ ...base, clientes, ultimaTrocaPorCliente, semanaCiclo: 1 });
    expect(out.map(c => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('em empate de tempo, desempata por porte (valor mensal somado)', () => {
    const clientes = [
      { id: 'a', tem_orquidea: true, grupo_servico: 'Manutenção', cliente_servicos: [{ valor_mensal: 500, ativo: true }] },
      { id: 'b', tem_orquidea: true, grupo_servico: 'Manutenção', cliente_servicos: [{ valor_mensal: 1500, ativo: true }] },
    ];
    const out = candidatosTroca({ ...base, clientes, semanaCiclo: 1 });
    expect(out.map(c => c.id)).toEqual(['b', 'a']);
  });

  it('porte ignora serviços inativos', () => {
    const clientes = [
      {
        id: 'a', tem_orquidea: true, grupo_servico: 'Manutenção',
        cliente_servicos: [{ valor_mensal: 500, ativo: true }, { valor_mensal: 9000, ativo: false }],
      },
    ];
    const out = candidatosTroca({ ...base, clientes, semanaCiclo: 1 });
    expect(out[0].porte).toBe(500);
  });
});
