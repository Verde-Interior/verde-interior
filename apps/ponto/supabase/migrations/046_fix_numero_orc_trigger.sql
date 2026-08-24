-- Migration 046: corrige geração de numero_orc
-- Problema: trigger era BEFORE UPDATE, mas o primeiro envio fazia INSERT com
-- status='enviado', portanto o trigger nunca disparava e numero_orc ficava NULL.
-- Solução: muda para BEFORE INSERT OR UPDATE, backfilla registros existentes
-- e alinha a sequência para evitar colisões.

-- 1. Atualizar a função para suportar INSERT e UPDATE
CREATE OR REPLACE FUNCTION public.gerar_numero_orc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'enviado'
     AND NEW.numero_orc IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'enviado') THEN
    NEW.numero_orc := 'ORC-' || LPAD(nextval('public.seq_orc_numero')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Recriar o trigger como BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_gerar_numero_orc ON public.orcamentos;
CREATE TRIGGER trg_gerar_numero_orc
  BEFORE INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_orc();

-- 3. Alinhar a sequência com o maior número já existente (evita colisão no backfill)
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(numero_orc, '[^0-9]', '', 'g') AS INTEGER)),
    0
  )
  INTO max_num
  FROM public.orcamentos
  WHERE numero_orc ~ '^ORC-\d+$';

  PERFORM setval('public.seq_orc_numero', GREATEST(max_num, 1));
END;
$$;

-- 4. Backfill: orçamentos enviados sem número (em ordem de criação)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM public.orcamentos
    WHERE status = 'enviado' AND numero_orc IS NULL
    ORDER BY criado_em ASC
  LOOP
    UPDATE public.orcamentos
    SET numero_orc = 'ORC-' || LPAD(nextval('public.seq_orc_numero')::TEXT, 3, '0')
    WHERE id = rec.id;
  END LOOP;
END;
$$;
