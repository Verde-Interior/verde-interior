-- Execute no Supabase SQL Editor após o schema.sql principal
-- Adiciona coluna de arquivos nas justificativas e cria bucket de storage

ALTER TABLE justifications ADD COLUMN IF NOT EXISTS files text[] DEFAULT '{}';

-- Bucket para anexos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('justifications', 'justifications', false)
  ON CONFLICT DO NOTHING;

-- Políticas de storage (autenticado pode fazer upload/download/delete)
CREATE POLICY "auth insert storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'justifications');

CREATE POLICY "auth select storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'justifications');

CREATE POLICY "auth delete storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'justifications');
