-- 034_clientes_bairro_regiao.sql
-- Preenche automaticamente clientes.bairro a partir do texto já cadastrado em
-- clientes.endereco (sem precisar de recadastro manual), e a partir do bairro
-- populado, monta um agrupamento simples em clientes.regiao (Zona Sul, Zona
-- Oeste, Centro, etc.) pra usar no Dashboard.
--
-- Como chegamos nisso: analisamos uma amostra real de ~150 endereços
-- cadastrados e identificamos que o texto segue vários formatos diferentes
-- (alguns "estilo Google Maps" completos, outros digitados à mão de formas
-- variadas). Os padrões abaixo cobrem os formatos encontrados na amostra.
-- Endereços fora de qualquer padrão reconhecido são deixados como estão
-- (bairro permanece NULL) — o relatório no final desta migration lista quem
-- sobrou, pra preenchimento manual pela tela de Clientes.
--
-- Uso: cole tudo isso no Supabase SQL Editor e execute.

BEGIN;

-- ── 1. Extração de bairro a partir de endereco ─────────────────────────
-- Só mexe em quem está com bairro vazio E tem algum endereco cadastrado.
-- Nunca sobrescreve um bairro já preenchido.

UPDATE public.clientes c
SET bairro = x.bairro_extraido
FROM (
  WITH base AS (
    SELECT
      id,
      endereco,
      -- Remove pedaços vazios (endereços com vírgula duplicada por erro de
      -- digitação, ex: ", , " quebrava a extração por posição)
      (
        SELECT array_agg(trim(p))
        FROM unnest(string_to_array(endereco, ',')) AS p
        WHERE trim(p) <> ''
      ) AS arr
    FROM public.clientes
    WHERE (bairro IS NULL OR trim(bairro) = '')
      AND endereco IS NOT NULL
      AND trim(endereco) <> ''
  ),
  cand AS (
    SELECT
      id,
      endereco,
      arr,
      array_length(arr, 1) AS n,
      -- A: Rua, número, BAIRRO, Cidade - UF, CEP, Brasil (6 partes)
      CASE
        WHEN array_length(arr, 1) = 6
         AND trim(arr[6]) ~* '^brasil$'
         AND trim(arr[5]) ~ '^\d{5}[.\-]?\d{3}$'
         AND trim(arr[4]) ~ '[-–]\s*[A-Za-zÀ-ÿ]{2}\s*$'
         AND trim(arr[3]) <> ''
        THEN trim(arr[3])
      END AS cand_a,
      -- A2: Rua, número, BAIRRO, Cidade-UF, CEP (5 partes, sem "Brasil")
      CASE
        WHEN array_length(arr, 1) = 5
         AND trim(arr[5]) ~ '^\d{5}[.\-]?\d{3}$'
         AND trim(arr[4]) ~ '[-–]\s*[A-Za-zÀ-ÿ]{2}\s*$'
         AND trim(arr[3]) <> ''
        THEN trim(arr[3])
      END AS cand_a2,
      -- C: Rua, número, BAIRRO, Cidade, UF, CEP (6 partes, cidade/UF separados)
      CASE
        WHEN array_length(arr, 1) = 6
         AND trim(arr[6]) ~ '^\d{2}\.?\d{3}[.\-]?\d{3}$'
         AND trim(arr[5]) ~ '^[A-Za-z]{2}$'
         AND trim(arr[4]) !~ '[-–]'
         AND trim(arr[3]) <> ''
        THEN trim(arr[3])
      END AS cand_c,
      -- Abbott: Rua, número, BAIRRO, Cidade-UF (4 partes, sem CEP/Brasil)
      CASE
        WHEN array_length(arr, 1) = 4
         AND trim(arr[2]) ~ '^\d+[A-Za-zºª°\/]*$'
         AND trim(arr[4]) ~ '[-–]\s*[A-Za-zÀ-ÿ]{2}\s*$'
         AND trim(arr[3]) <> ''
        THEN trim(arr[3])
      END AS cand_abbott,
      -- Nordika: Rua, número, BAIRRO, Cidade "pura" (4 partes)
      CASE
        WHEN array_length(arr, 1) = 4
         AND trim(arr[2]) ~ '^\d+[A-Za-zºª°\/]*$'
         AND trim(arr[4]) !~ '[-–]'
         AND trim(arr[4]) !~ '^\d'
         AND length(trim(arr[4])) > 2
         AND trim(arr[3]) <> ''
        THEN trim(arr[3])
      END AS cand_nordika,
      -- SESC27: Rua, BAIRRO, Cidade-UF, CEP (4 partes, sem número de casa)
      CASE
        WHEN array_length(arr, 1) = 4
         AND trim(arr[2]) !~ '^\d'
         AND trim(arr[4]) ~ '^\d{5}[.\-]?\d{3}$'
         AND trim(arr[2]) <> ''
        THEN trim(arr[2])
      END AS cand_sem_num,
      -- Clínica: Rua, BAIRRO, Cidade - UF, Brasil (4 partes, sem número/CEP)
      CASE
        WHEN array_length(arr, 1) = 4
         AND trim(arr[2]) !~ '^\d'
         AND trim(arr[4]) ~* '^brasil$'
         AND trim(arr[3]) ~ '[-–]\s*[A-Za-zÀ-ÿ]{2}\s*$'
         AND trim(arr[2]) <> ''
        THEN trim(arr[2])
      END AS cand_clinica,
      -- Allied/Electrolux: Rua, BAIRRO, Cidade - UF, CEP, Brasil (5 partes,
      -- sem número de casa, mas com CEP)
      CASE
        WHEN array_length(arr, 1) = 5
         AND trim(arr[2]) !~ '^\d'
         AND trim(arr[5]) ~* '^brasil$'
         AND trim(arr[4]) ~ '^\d{5}[.\-]?\d{3}$'
         AND trim(arr[3]) ~ '[-–]\s*[A-Za-zÀ-ÿ]{2}\s*$'
         AND trim(arr[2]) <> ''
        THEN trim(arr[2])
      END AS cand_clinica_cep,
      -- Bairro embutido depois do número da casa, em qualquer lugar da
      -- string: "..., 311 - Tamboré, ..." ou "..., nº 1700 | Bairro, ..."
      NULLIF(
        trim(
          (regexp_match(
            endereco,
            ',\s*(?:n[ºo°]?\.?\s*)?\d+[A-Za-zºª°]*(?:\/\d+[A-Za-zºª°]*)?\s*[-–\|]\s*([^,\-–\|]+?)\s*(,|[-–\|]|$)'
          ))[1]
        ),
        ''
      ) AS cand_b_raw,
      -- "no bairro X" por extenso
      NULLIF(
        trim(
          (regexp_match(endereco, 'no bairro\s+([^,]+)$', 'i'))[1]
        ),
        ''
      ) AS cand_nobairro
    FROM base
  ),
  final AS (
    SELECT
      id,
      CASE
        WHEN split_part(cand_b_raw, ' ', 1) ILIKE ANY (ARRAY[
          'rua','r.','r','av','av.','avenida','alameda','al','al.',
          'praça','estrada','travessa'
        ]) THEN NULL
        WHEN cand_b_raw ~ '^\d' THEN NULL
        WHEN length(cand_b_raw) < 3 THEN NULL
        ELSE replace(replace(replace(replace(
               initcap(cand_b_raw),
               ' De ', ' de '), ' Da ', ' da '), ' Do ', ' do '), ' Dos ', ' dos ')
      END AS cand_b,
      cand_a, cand_a2, cand_c, cand_abbott, cand_nordika,
      cand_sem_num, cand_clinica, cand_clinica_cep, cand_nobairro
    FROM cand
  )
  SELECT
    id,
    COALESCE(
      cand_a, cand_a2, cand_c, cand_abbott, cand_nordika,
      cand_sem_num, cand_clinica, cand_clinica_cep, cand_b, cand_nobairro
    ) AS bairro_extraido
  FROM final
) x
WHERE c.id = x.id
  AND x.bairro_extraido IS NOT NULL;

-- ── 2. Casos revisados manualmente (geocodificação + referência cruzada
--      com clientes vizinhos já confirmados no mesmo endereço/rua) ──────
-- Só aplica em quem continua sem bairro depois do passo 1.

-- AccesStage
UPDATE public.clientes SET bairro = 'Cerqueira César'
 WHERE id = 'b54a4720-c877-40f8-b032-f0b4e3bafefa'
   AND (bairro IS NULL OR trim(bairro) = '');

-- Argus
UPDATE public.clientes SET bairro = 'Paraíso'
 WHERE id = 'a61ebc09-7f68-436e-86be-b95780027748'
   AND (bairro IS NULL OR trim(bairro) = '');

-- Chiarottino (mesma Av. JK de FTI/FREC/STEN)
UPDATE public.clientes SET bairro = 'Itaim Bibi'
 WHERE id = 'a33245d6-e94d-44c7-abf8-cf649cde3197'
   AND (bairro IS NULL OR trim(bairro) = '');

-- Cond. Paulista 2028
UPDATE public.clientes SET bairro = 'Consolação'
 WHERE id = 'ce744e0a-96e2-41b9-84d8-3f545ab9648c'
   AND (bairro IS NULL OR trim(bairro) = '');

-- Consulado Geral da Suíça
UPDATE public.clientes SET bairro = 'Bela Vista'
 WHERE id = 'f7d5bbdb-7f95-4942-8af5-ca4557212911'
   AND (bairro IS NULL OR trim(bairro) = '');

-- Corelaw
UPDATE public.clientes SET bairro = 'Jardim Paulista'
 WHERE id = '6df5a4dd-2699-414e-9421-84877b7d591d'
   AND (bairro IS NULL OR trim(bairro) = '');

-- Datora JK (mesma Av. JK de FTI/FREC/STEN)
UPDATE public.clientes SET bairro = 'Itaim Bibi'
 WHERE id = '395c0725-1c18-4e59-a6c8-5c676d96f0ad'
   AND (bairro IS NULL OR trim(bairro) = '');

-- EVENTO (mesmo endereço da Verde Interior)
UPDATE public.clientes SET bairro = 'Lapa'
 WHERE id = '67f84886-e74f-4c7d-8430-347bca3ee999'
   AND (bairro IS NULL OR trim(bairro) = '');

-- F Iniciativas
UPDATE public.clientes SET bairro = 'Bela Vista'
 WHERE id = '96b12a74-0b1e-4b34-af50-87705c2030b9'
   AND (bairro IS NULL OR trim(bairro) = '');

-- Live Higienópolis
UPDATE public.clientes SET bairro = 'Higienópolis'
 WHERE id = '50c22bb8-f870-4e76-8d8d-f54d5ea8aee7'
   AND (bairro IS NULL OR trim(bairro) = '');

-- PTC BIO
UPDATE public.clientes SET bairro = 'Brooklin Novo'
 WHERE id = '292069e7-78aa-47d3-b9ec-68fdebfb59bb'
   AND (bairro IS NULL OR trim(bairro) = '');

-- SPX (mesmo prédio do cliente B32)
UPDATE public.clientes SET bairro = 'Itaim Bibi'
 WHERE id = '6b439887-5781-42b2-99e4-693ce1091934'
   AND (bairro IS NULL OR trim(bairro) = '');

-- ── 3. Coluna Região (agrupamento simples a partir do bairro) ──────────

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS regiao TEXT;

COMMENT ON COLUMN public.clientes.regiao IS
  'Região/zona do cliente (ex: Zona Sul, Zona Oeste) — agrupamento informal
   calculado a partir do bairro, usado no Dashboard. Ajustável conforme
   convenção do negócio.';

UPDATE public.clientes SET regiao = 'Zona Oeste'
 WHERE regiao IS NULL AND lower(regexp_replace(bairro, '\s*\(.*\)\s*$', '')) IN (
   'itaim bibi','pinheiros','vila olimpia','vila olímpia','jardim paulista',
   'jardins','alto de pinheiros','vila madalena','vila leopoldina','butantã',
   'butanta','lapa','lapa de baixo','barra funda','água branca','agua branca',
   'vila anastácio','vila anastacio','vila nova conceição','vila nova conceicao',
   'cidade monções','cidade monces','jd paulistano','jd. paulistano',
   'cerqueira césar','cerqueira cesar','tamboré','tambore',
   'alphaville industrial','vila hamburguesa'
 );

UPDATE public.clientes SET regiao = 'Zona Sul'
 WHERE regiao IS NULL AND lower(regexp_replace(bairro, '\s*\(.*\)\s*$', '')) IN (
   'moema','vila mariana','santo amaro','morumbi','brooklin','brooklin novo',
   'chácara santo antônio','chacara santo antonio','campo belo','socorro',
   'chácara klabin','chacara klabin','cidade jardim','vila quitauna','paraíso',
   'paraiso'
 );

UPDATE public.clientes SET regiao = 'Centro'
 WHERE regiao IS NULL AND lower(regexp_replace(bairro, '\s*\(.*\)\s*$', '')) IN (
   'bela vista','consolação','consolacao','liberdade','sé','se',
   'república','republica','higienópolis','higienopolis'
 );

UPDATE public.clientes SET regiao = 'Zona Norte'
 WHERE regiao IS NULL AND lower(regexp_replace(bairro, '\s*\(.*\)\s*$', '')) IN (
   'santana','tucuruvi','vila guilherme'
 );

UPDATE public.clientes SET regiao = 'Zona Leste'
 WHERE regiao IS NULL AND lower(regexp_replace(bairro, '\s*\(.*\)\s*$', '')) IN (
   'tatuapé','tatuape','mooca','penha'
 );

UPDATE public.clientes SET regiao = 'Grande São Paulo'
 WHERE regiao IS NULL AND lower(regexp_replace(bairro, '\s*\(.*\)\s*$', '')) IN (
   'jubran','barueri','osasco'
 );

COMMIT;

-- ── 4. Relatório final: quem ficou sem bairro e/ou sem região ──────────
-- Copie os resultados e revise manualmente (tela Clientes → editar).

SELECT nome_empresa, endereco, bairro, regiao
  FROM public.clientes
 WHERE ativo = TRUE AND (bairro IS NULL OR trim(bairro) = '')
 ORDER BY nome_empresa;

SELECT bairro, count(*) AS clientes_sem_regiao
  FROM public.clientes
 WHERE ativo = TRUE AND bairro IS NOT NULL AND trim(bairro) <> '' AND regiao IS NULL
 GROUP BY bairro
 ORDER BY clientes_sem_regiao DESC;
