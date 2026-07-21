-- 021_fix_cascades_lead_delete.sql
-- Corrige 2 problemas ao remover um lead que tenha OS e/ou agenda com relatório:
--
-- 1. `ordens_servico.lead_id` estava com ON DELETE SET NULL. Quando o lead era
--    apagado, o lead_id virava NULL. Se o cliente_id também fosse NULL (caso
--    normal de lead que nunca virou cliente), o CHECK `os_cliente_ou_lead`
--    disparava e o DELETE do lead falhava.
--    Fix: OS gerada de lead vira ORFÃ se o lead for deletado? Não. Muito melhor
--    seguir a semântica: OS existe SÓ enquanto lead ou cliente existir. Mudo
--    pra ON DELETE CASCADE — deleta a OS junto com o lead.
--
-- 2. `relatorios.agendamento_id` não tinha ON DELETE. Quando o lead era
--    deletado (que faz agenda CASCADE) → tentava apagar agenda → mas relatorios
--    apontava pra essa agenda sem CASCADE → falhava com FK constraint.
--    Fix: CASCADE. Se a agenda vai embora, o relatório também (nunca fez
--    sentido ter relatório de agenda apagada).

-- ── 1. ordens_servico.lead_id: SET NULL → CASCADE ─────────────
ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_lead_id_fkey;
ALTER TABLE public.ordens_servico
  ADD CONSTRAINT ordens_servico_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- (cliente_id fica com SET NULL — cliente deletado NÃO deve tirar a OS
--  se o lead ainda existir. O CHECK garante que ao menos um dos dois exista.)

-- ── 2. relatorios.agendamento_id: NO ACTION → CASCADE ────────
ALTER TABLE public.relatorios
  DROP CONSTRAINT IF EXISTS relatorios_agendamento_id_fkey;
ALTER TABLE public.relatorios
  ADD CONSTRAINT relatorios_agendamento_id_fkey
  FOREIGN KEY (agendamento_id) REFERENCES public.agenda(id) ON DELETE CASCADE;
