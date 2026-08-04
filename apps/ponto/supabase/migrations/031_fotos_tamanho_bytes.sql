-- ============================================================
-- 031_fotos_tamanho_bytes.sql
-- Rastreio de consumo de dados por colaborador (fotos de visita)
-- ============================================================
-- Contexto: gestão quer saber quanto de internet cada colaborador
-- consome usando o app Ponto em campo. As fotos de visita (já
-- comprimidas em WebP no cliente, ~40-80KB cada) são de longe o
-- maior componente desse consumo — chamadas de API são JSON
-- pequeno e não valem o custo/fragilidade de instrumentar via
-- Performance API do navegador (Supabase não expõe
-- Timing-Allow-Origin, então o tamanho reportaria zero).
--
-- Esta coluna grava o tamanho (bytes) do arquivo já comprimido,
-- capturado no app no momento do upload (agenda.js:tentarUploadFoto),
-- sem depender de nenhuma medição de rede.
-- ============================================================

ALTER TABLE public.fotos_relatorio
  ADD COLUMN IF NOT EXISTS tamanho_bytes INTEGER;

COMMENT ON COLUMN public.fotos_relatorio.tamanho_bytes IS
  'Tamanho em bytes do arquivo já comprimido, capturado no momento do upload. Usado para estimar consumo de dados por colaborador (soma agrupada por relatorios.funcionario_id).';
