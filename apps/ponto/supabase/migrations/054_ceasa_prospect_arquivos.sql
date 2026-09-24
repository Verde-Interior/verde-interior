-- ============================================================
-- 054_ceasa_prospect_arquivos.sql
-- Anexos de proposta por lead do pipeline Ceasa/Holambra (1 lead -> N
-- arquivos, para guardar histórico de propostas enviadas/reenviadas).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ceasa_prospect_arquivos (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id    UUID         NOT NULL REFERENCES public.ceasa_prospects(id) ON DELETE CASCADE,
  nome_arquivo   TEXT         NOT NULL,
  storage_path   TEXT         NOT NULL,
  tamanho_bytes  BIGINT,
  enviado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ceasa_prospect_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ceasa_prospect_arquivos_auth_all"
  ON public.ceasa_prospect_arquivos FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_ceasa_prospect_arquivos_prospect ON public.ceasa_prospect_arquivos(prospect_id);

-- ── Bucket de storage para os arquivos de proposta ──────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('ceasa-propostas', 'ceasa-propostas', false)
  ON CONFLICT DO NOTHING;

CREATE POLICY "ceasa_propostas_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ceasa-propostas');

CREATE POLICY "ceasa_propostas_auth_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ceasa-propostas');

CREATE POLICY "ceasa_propostas_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ceasa-propostas');
