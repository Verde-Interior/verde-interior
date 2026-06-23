-- Apenas o gestor pode excluir registros de ponto
-- Execute no Supabase SQL Editor
DROP POLICY IF EXISTS "delete punch_records" ON punch_records;

CREATE POLICY "delete punch_records" ON punch_records
  FOR DELETE TO authenticated
  USING (is_gestor());
