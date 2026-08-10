// src/utils/regaHelpers.test.js
import { describe, it, expect } from 'vitest';
import { gerarRegaDaSemana } from './regaHelpers';

describe('gerarRegaDaSemana', () => {
  const semanaAnteriorBase = '2026-08-03'; // segunda
  const semanaNovaBase     = '2026-08-10'; // segunda seguinte

  it('copia uma visita comum de rega, deslocando 7 dias', () => {
    const clientesPorId = new Map([['c1', { nome_empresa: 'A', frequencia_visita: 'semanal' }]]);
    const { linhas, excluidos } = gerarRegaDaSemana({
      agendaSemanaAnterior: [
        { cliente_id: 'c1', funcionario_id: 'f1', data_agendada: '2026-08-04', hora_estimada_chegada: '08:00', tipos_tarefa: ['manutencao'], ordem_rota: 0 },
      ],
      clientesPorId,
      visitasDoMesPorCliente: new Map(),
      semanaAnteriorBase, semanaNovaBase,
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].data_agendada).toBe('2026-08-11'); // terça da semana nova
    expect(linhas[0].status).toBe('rascunho');
    expect(excluidos.avulsa).toHaveLength(0);
  });

  it('exclui visita sem cliente_id (avulsa/lead)', () => {
    const { linhas, excluidos } = gerarRegaDaSemana({
      agendaSemanaAnterior: [{ cliente_id: null, data_agendada: '2026-08-04' }],
      clientesPorId: new Map(),
      visitasDoMesPorCliente: new Map(),
      semanaAnteriorBase, semanaNovaBase,
    });
    expect(linhas).toHaveLength(0);
    expect(excluidos.avulsa).toHaveLength(1);
  });

  it('exclui troca/reforma/evento — não é rega padrão', () => {
    const clientesPorId = new Map([['c1', { frequencia_visita: 'semanal' }]]);
    const { linhas, excluidos } = gerarRegaDaSemana({
      agendaSemanaAnterior: [
        { cliente_id: 'c1', data_agendada: '2026-08-04', tipos_tarefa: ['troca'] },
        { cliente_id: 'c1', data_agendada: '2026-08-05', tipos_tarefa: ['evento'] },
      ],
      clientesPorId,
      visitasDoMesPorCliente: new Map(),
      semanaAnteriorBase, semanaNovaBase,
    });
    expect(linhas).toHaveLength(0);
    expect(excluidos.troca).toHaveLength(2);
  });

  it('exclui quinzenal incondicionalmente (por definição, semana seguinte não repete)', () => {
    const clientesPorId = new Map([['c1', { frequencia_visita: 'quinzenal' }]]);
    const { linhas, excluidos } = gerarRegaDaSemana({
      agendaSemanaAnterior: [{ cliente_id: 'c1', data_agendada: '2026-08-04', tipos_tarefa: ['manutencao'] }],
      clientesPorId,
      visitasDoMesPorCliente: new Map(),
      semanaAnteriorBase, semanaNovaBase,
    });
    expect(linhas).toHaveLength(0);
    expect(excluidos.quinzenal).toHaveLength(1);
  });

  it('exclui pontual só se já teve visita esse mês', () => {
    const clientesPorId = new Map([
      ['c1', { frequencia_visita: 'pontual' }],
      ['c2', { frequencia_visita: 'pontual' }],
    ]);
    const { linhas, excluidos } = gerarRegaDaSemana({
      agendaSemanaAnterior: [
        { cliente_id: 'c1', data_agendada: '2026-08-04', tipos_tarefa: ['manutencao'] },
        { cliente_id: 'c2', data_agendada: '2026-08-05', tipos_tarefa: ['manutencao'] },
      ],
      clientesPorId,
      visitasDoMesPorCliente: new Map([['c1', 1]]), // c1 já foi atendido esse mês
      semanaAnteriorBase, semanaNovaBase,
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].cliente_id).toBe('c2');
    expect(excluidos.pontual).toHaveLength(1);
  });

  it('preserva funcionário, hora, duração, serviço e ordem da visita original', () => {
    const clientesPorId = new Map([['c1', { frequencia_visita: 'semanal' }]]);
    const { linhas } = gerarRegaDaSemana({
      agendaSemanaAnterior: [{
        cliente_id: 'c1', funcionario_id: 'f9', data_agendada: '2026-08-06',
        hora_estimada_chegada: '09:30', duracao_estimada_min: 45,
        cliente_servico_id: 'srv-1', tipos_tarefa: ['manutencao'],
        observacoes_gestor: 'obs', ordem_rota: 3,
      }],
      clientesPorId,
      visitasDoMesPorCliente: new Map(),
      semanaAnteriorBase, semanaNovaBase,
    });
    expect(linhas[0]).toMatchObject({
      funcionario_id: 'f9', hora_estimada_chegada: '09:30', duracao_estimada_min: 45,
      cliente_servico_id: 'srv-1', observacoes_gestor: 'obs', ordem_rota: 3,
    });
  });
});
