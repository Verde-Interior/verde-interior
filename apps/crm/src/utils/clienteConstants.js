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
