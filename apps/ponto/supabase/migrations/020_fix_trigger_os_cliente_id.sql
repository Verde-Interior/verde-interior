-- 020_fix_trigger_os_cliente_id.sql
-- Corrige o trigger `gerar_os_de_lead_aprovado` que referenciava NEW.cliente_id
-- (coluna que NÃO existe em leads). O nome correto é cliente_supabase_id.
--
-- Sintoma: ao mover lead para `orcamento_aprovado`, o trigger falhava e a OS
-- nunca era criada (dependendo do modo de execução, o próprio UPDATE do
-- estagio_id também podia ser silenciosamente descartado).

CREATE OR REPLACE FUNCTION public.gerar_os_de_lead_aprovado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só age quando o estágio ACABOU de virar orcamento_aprovado
  IF NEW.estagio_id = 'orcamento_aprovado'
     AND (OLD.estagio_id IS DISTINCT FROM 'orcamento_aprovado') THEN

    -- Se já existe OS pra esse lead, não duplica (evita reentrada por edições)
    IF NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE lead_id = NEW.id) THEN
      INSERT INTO public.ordens_servico (lead_id, cliente_id, origem, status, observacoes)
      VALUES (
        NEW.id,
        NEW.cliente_supabase_id,   -- FIX: era NEW.cliente_id (coluna inexistente)
        'trigger_aprovacao',
        'rascunho',
        'OS gerada automaticamente ao aprovar o orçamento do lead.'
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Backfill: cria OS para leads que já estão em orcamento_aprovado e não têm OS.
-- (Cobre o caso do usuário que aprovou antes de aplicar essa migration.)
INSERT INTO public.ordens_servico (lead_id, cliente_id, origem, status, observacoes)
SELECT
  l.id,
  l.cliente_supabase_id,
  'trigger_aprovacao',
  'rascunho',
  'OS gerada retroativamente (backfill 020).'
FROM public.leads l
WHERE l.estagio_id = 'orcamento_aprovado'
  AND NOT EXISTS (
    SELECT 1 FROM public.ordens_servico o WHERE o.lead_id = l.id
  );
