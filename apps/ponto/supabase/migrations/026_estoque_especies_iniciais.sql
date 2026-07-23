-- ============================================================
-- 026_estoque_especies_iniciais.sql
-- Carga inicial: 37 espécies + 260 patrimônios individuais
-- Aplicado em: 23/07/2026
-- ============================================================
-- Todos os patrimônios criados com status='disponivel'.
-- QR codes: VI-0001 a VI-0260 (sequência patrimonio_qr_seq).
-- Um evento 'cadastro' é registrado pra cada patrimônio.
-- ============================================================

-- ── 1. Espécies ───────────────────────────────────────────────
INSERT INTO public.estoque_especies (nome, categoria) VALUES
  ('Dracena compacta',            'interna'),
  ('Pleomele grande',             'interna'),
  ('Pleomele pequena',            'interna'),
  ('Bromélia',                    'interna'),
  ('Ficus cloe',                  'interna'),
  ('Antúrio jenmani',             'interna'),
  ('Lança',                       'interna'),
  ('Costela grande',              'interna'),
  ('Costela média',               'interna'),
  ('Ficus lyrata',                'interna'),
  ('Pata de elefante pequena',    'interna'),
  ('Filodendro scandens',         'interna'),
  ('Chaminha',                    'interna'),
  ('Zamioculca',                  'interna'),
  ('Zamioculca mini preta',       'interna'),
  ('Zamioculca preta',            'interna'),
  ('Jiboia cuia',                 'interna'),
  ('Filodendro cuia',             'interna'),
  ('Cacto mini',                  'interna'),
  ('Suculenta pequena',           'interna'),
  ('Suculenta grande',            'interna'),
  ('Sanderiana trancada',         'interna'),
  ('Pau d''água',                 'interna'),
  ('Jiboia',                      'interna'),
  ('Laciniato',                   'interna'),
  ('Cara de cavalo',              'interna'),
  ('CNP',                         'interna'),
  ('Alface',                      'interna'),
  ('Ficus audrey',                'interna'),
  ('Bamburanta',                  'interna'),
  ('Yucca',                       'interna'),
  ('Espada de São Jorge',         'interna'),
  ('Espada de São Bárbara grande','interna'),
  ('Espada de São Bárbara pequena','interna'),
  ('Pleomele pequena variegata',  'interna'),
  ('Cheflera',                    'interna'),
  ('Ravenala',                    'interna')
ON CONFLICT (nome) DO NOTHING;

-- ── 2. Patrimônios individuais ────────────────────────────────
-- Cria N patrimônios por espécie e registra evento 'cadastro'
DO $$
DECLARE
  r      RECORD;
  i      INTEGER;
  v_id   UUID;
  v_qr   TEXT;
BEGIN
  FOR r IN (
    SELECT e.id AS especie_id, t.qtd
    FROM (VALUES
      ('Dracena compacta',             5),
      ('Pleomele grande',              7),
      ('Pleomele pequena',             3),
      ('Bromélia',                     6),
      ('Ficus cloe',                   5),
      ('Antúrio jenmani',              2),
      ('Lança',                        7),
      ('Costela grande',               6),
      ('Costela média',                2),
      ('Ficus lyrata',                 3),
      ('Pata de elefante pequena',     3),
      ('Filodendro scandens',          9),
      ('Chaminha',                    12),
      ('Zamioculca',                  37),
      ('Zamioculca mini preta',        8),
      ('Zamioculca preta',             8),
      ('Jiboia cuia',                  7),
      ('Filodendro cuia',              7),
      ('Cacto mini',                  17),
      ('Suculenta pequena',           37),
      ('Suculenta grande',             8),
      ('Sanderiana trancada',          2),
      ('Pau d''água',                  4),
      ('Jiboia',                       4),
      ('Laciniato',                    6),
      ('Cara de cavalo',               1),
      ('CNP',                          6),
      ('Alface',                       2),
      ('Ficus audrey',                 1),
      ('Bamburanta',                   1),
      ('Yucca',                        4),
      ('Espada de São Jorge',         12),
      ('Espada de São Bárbara grande', 3),
      ('Espada de São Bárbara pequena',3),
      ('Pleomele pequena variegata',   5),
      ('Cheflera',                     5),
      ('Ravenala',                     2)
    ) AS t(nome, qtd)
    JOIN public.estoque_especies e ON e.nome = t.nome
  ) LOOP
    FOR i IN 1..r.qtd LOOP
      v_qr := public.gerar_qr_codigo_patrimonio();
      v_id := gen_random_uuid();

      INSERT INTO public.estoque_patrimonios (id, qr_codigo, especie_id, status)
      VALUES (v_id, v_qr, r.especie_id, 'disponivel');

      INSERT INTO public.estoque_eventos (patrimonio_id, tipo, observacoes)
      VALUES (v_id, 'cadastro', 'Carga inicial — migration 026');
    END LOOP;
  END LOOP;
END;
$$;
