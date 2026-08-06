// src/utils/clienteConstants.js — labels compartilhados entre Clientes e telas que exibem dados de cliente (ex: Mapa)

export const DIAS_SEMANA = [
  { id: 'segunda', label: 'Seg' },
  { id: 'terca',   label: 'Ter' },
  { id: 'quarta',  label: 'Qua' },
  { id: 'quinta',  label: 'Qui' },
  { id: 'sexta',   label: 'Sex' },
  { id: 'sabado',  label: 'Sáb' },
];

export const TIPO_LABEL = {
  manutencao: 'Manutenção',
  locacao:    'Locação',
  flores:     'Flores',
  reforma:    'Reforma',
  venda:      'Venda',
  evento:     'Evento',
};

export const FREQ_LABEL = {
  semanal:    'Semanal',
  quinzenal:  'Quinzenal',
  mensal:     'Mensal',
  pontual:    'Pontual',
};

// Rótulo do campo clientes.frequencia_visita — escala diferente da FREQ_LABEL
// acima (que é de cliente_servicos.frequencia): aqui o cadastro grava
// 1x_semana/2x_semana/3x_semana em vez de um "semanal" genérico.
export const FREQ_VISITA_LABEL = {
  '3x_semana': '3× por semana',
  '2x_semana': '2× por semana',
  '1x_semana': '1× por semana',
  quinzenal:   'Quinzenal',
  mensal:      'Mensal',
};
