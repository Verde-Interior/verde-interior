-- ============================================================
-- 009_storage_anon_read.sql
-- Leitura anon do bucket field-photos (para o CRM)
-- Aplicado em: 06/07/2026
-- ============================================================
-- CRM ainda não tem auth. Para exibir fotos + assinaturas dos
-- relatórios de campo na tela Relatórios, permitir SELECT anon
-- nos objetos do bucket field-photos.
-- REMOVER quando auth for implementado no CRM.
-- ============================================================

DROP POLICY IF EXISTS "field_photos_anon_read" ON storage.objects;
CREATE POLICY "field_photos_anon_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'field-photos');
