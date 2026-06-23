-- Adiciona colunas de geolocalização nos registros de ponto
-- Execute no Supabase SQL Editor
ALTER TABLE punch_records
  ADD COLUMN IF NOT EXISTS lat  double precision,
  ADD COLUMN IF NOT EXISTS lng  double precision;
