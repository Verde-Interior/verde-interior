-- 024_merge_duplicados_clientes.sql
-- Junta 24 duplicados criados por 023 (planilha) com os originais do CRM,
-- e limpa registros de teste.
--
-- Regra: planilha vence, EXCETO quando o valor da planilha seria "Grupo X"
-- (formato antigo, considerado inválido) — nesse caso mantém o valor do CRM.
--
-- Ao final:
--   * Cada empresa fica com UM registro (o do CRM, com endereço/dados originais)
--   * Grupo e tem_orquidea vêm da planilha (fonte de verdade)
--   * Duplicados criados pela 023 são deletados
--   * 3 registros de teste apagados
--
-- Bloco C (Arquia + ARQUIA + ARQIA): mantido como está (usuário confirmou).

BEGIN;

CREATE TEMP TABLE _merges (
  keep_nome  TEXT NOT NULL,   -- nome existente no CRM que fica
  drop_nome  TEXT NOT NULL,   -- nome duplicado da planilha que sai
  grupo      TEXT NOT NULL,   -- grupo final aplicado
  orq        BOOLEAN NOT NULL -- tem_orquidea final aplicado
) ON COMMIT DROP;

INSERT INTO _merges VALUES
  ('23 S CAPITAL',                                            '23S CAPITAL',                 'Manutenção com troca', TRUE),
  ('Allen & Overy',                                           'ALLEN OVERY',                 'Manutenção com troca', FALSE),
  ('AMARIS MANTU',                                            'AMARIS',                      'Manutenção',           FALSE),
  ('Auster',                                                  'AUSTER OPPORTUNITY',          'Locação',              TRUE),
  ('Boa Vista Investimentos',                                 'BOA VISTA INV',               'Locação',              TRUE),
  ('BRADESCO POC',                                            'BRADESCO',                    'Manutenção',           FALSE),
  ('CAR-Law',                                                 'CARLAW',                      'Somente orquídea',     TRUE),
  ('Clínica Matheus Arantes',                                 'CLINICA MATHEUS',             'Somente orquídea',     TRUE),
  ('Cond. Paulista 2028',                                     'COND. PAULISTA',              'Locação',              TRUE),
  ('Datora FL',                                               'DATORA FARIA LIMA',           'Locação',              TRUE),
  ('Europ - Jardim',                                          'EUROP',                       'Locação',              TRUE),
  ('FORT GESTÃO',                                             'FORT GESTAO',                 'Manutenção',           FALSE),
  ('Grinberg',                                                'GRIMBERG',                    'Manutenção',           FALSE),
  ('Live - Oscar Freire',                                     'LIVE OSCAR FREIRE',           'Manutenção com troca', FALSE),
  ('Loja Track & Field',                                      'TRACK AND FIELD LOJA',        'Manutenção com troca', FALSE),
  ('MedSystems',                                              'MED SYSTEMS',                 'Somente orquídea',     TRUE),
  ('Pacaembu Serviços',                                       'PACAEMBU',                    'Locação',              FALSE),
  ('PTC BIO',                                                 'PTC',                         'Locação',              TRUE),
  ('RGSH  RAMOS, GUTIERRES, SALGADO E HIGASHINO ADVOGADOS',   'RGSH',                        'Manutenção',           FALSE),
  ('RM ADVOGADOS',                                            'RM ADV',                      'Locação',              TRUE),
  ('SOLENIS JARDIM',                                          'SOLENIS',                     'Manutenção com troca', FALSE),
  ('STOCK DISTRIBUIDORA',                                     'STOCK',                       'Manutenção com troca', FALSE),
  ('Sysmex',                                                  'SYSMEX NAÇÕES',               'Manutenção com troca', TRUE),
  ('Track & Field',                                           'TRACK AND FIELD ESCRITORIO',  'Manutenção com troca', TRUE);

-- 1. Aplica grupo/orquídea nos registros originais do CRM
UPDATE public.clientes c
   SET grupo_servico = m.grupo,
       tem_orquidea  = m.orq
  FROM _merges m
 WHERE UPPER(REGEXP_REPLACE(TRIM(c.nome_empresa), '\s+', ' ', 'g'))
     = UPPER(REGEXP_REPLACE(TRIM(m.keep_nome),    '\s+', ' ', 'g'));

-- 2. Deleta os registros duplicados que a 023 inseriu.
--    Como acabaram de ser criados, não têm agenda/ordens_servico apontando —
--    o DELETE é seguro.
DELETE FROM public.clientes c
 USING _merges m
 WHERE UPPER(REGEXP_REPLACE(TRIM(c.nome_empresa), '\s+', ' ', 'g'))
     = UPPER(REGEXP_REPLACE(TRIM(m.drop_nome),    '\s+', ' ', 'g'));

-- 3. Registros de teste solicitados pelo usuário
DELETE FROM public.clientes
 WHERE nome_empresa IN (
   'Cliente de Teste',
   'Cliente teste',
   'Cliente teste - Treinamento'
 );

COMMIT;

-- ── Diagnóstico opcional (rode depois pra conferir) ──────────
-- Deve retornar 0 se todos os duplicados foram removidos:
-- SELECT COUNT(*) AS duplicados_restantes FROM public.clientes
--  WHERE UPPER(nome_empresa) IN (
--    '23S CAPITAL','ALLEN OVERY','AMARIS','AUSTER OPPORTUNITY','BOA VISTA INV',
--    'BRADESCO','CARLAW','CLINICA MATHEUS','COND. PAULISTA','DATORA FARIA LIMA',
--    'EUROP','FORT GESTAO','GRIMBERG','LIVE OSCAR FREIRE','TRACK AND FIELD LOJA',
--    'MED SYSTEMS','PACAEMBU','PTC','RGSH','RM ADV','SOLENIS','STOCK',
--    'SYSMEX NAÇÕES','TRACK AND FIELD ESCRITORIO'
--  );
