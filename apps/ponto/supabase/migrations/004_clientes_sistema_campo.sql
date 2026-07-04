-- ============================================================
-- 004_clientes_sistema_campo.sql
-- Sistema de Campo — Substituto do Auvo
-- Criado em: 01/07/2026
-- ============================================================
-- Execute no Supabase SQL Editor (dashboard.supabase.com)
-- Projeto: mcaqxfogzvrqqnoixptv
-- ============================================================

-- ── 1. CLIENTES ──────────────────────────────────────────────
-- Base de clientes ativos com contratos e restrições de acesso.
-- Importada do Auvo + campos extras preenchidos manualmente.

CREATE TABLE IF NOT EXISTS public.clientes (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_empresa          TEXT         NOT NULL,
  cnpj                  TEXT,
  razao_social          TEXT,
  contato_nome          TEXT,                          -- "Falar com" — quem assina o relatório
  contato_telefone      TEXT,
  contato_email         TEXT,
  endereco              TEXT         NOT NULL,
  complemento           TEXT,
  lat                   DOUBLE PRECISION NOT NULL,
  lng                   DOUBLE PRECISION NOT NULL,
  bairro                TEXT,
  dias_disponiveis      TEXT[]       DEFAULT '{}',     -- ex: ["segunda","quarta"]
  janela_entrada_inicio TIME,                          -- ex: 08:00 — pode chegar a partir de
  janela_entrada_fim    TIME,                          -- ex: 09:00 — deve ter chegado até
  duracao_estimada_min  INTEGER,                       -- minutos para concluir a visita
  grupo_servico         TEXT,                          -- campo original do Auvo (Grupo 1, 2, 3, 4)
  observacoes           TEXT,                          -- visível para o funcionário no campo
  observacoes_internas  TEXT,                          -- visível só para o gestor
  ativo                 BOOLEAN      NOT NULL DEFAULT TRUE,
  data_inicio_contrato  DATE,
  ultima_visita         DATE,                          -- atualizada após cada relatório concluído
  data_cadastro         DATE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. CLIENTE_SERVICOS ───────────────────────────────────────
-- Um cliente pode ter múltiplos contratos simultâneos
-- (ex: locação + manutenção ao mesmo tempo).

CREATE TABLE IF NOT EXISTS public.cliente_servicos (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID         NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_servico     TEXT         NOT NULL
                     CHECK (tipo_servico IN ('manutencao','locacao','flores','reforma','venda','evento')),
  frequencia       TEXT         NOT NULL
                     CHECK (frequencia IN ('semanal','quinzenal','mensal','pontual')),
  quantidade_vasos INTEGER,
  valor_mensal     NUMERIC(10,2),
  ativo            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 3. AGENDA ─────────────────────────────────────────────────
-- Escala diária criada pelo gestor. Fica como rascunho até
-- ser publicado — só então aparece para o funcionário no celular.
-- funcionario_id armazena employees.id (texto para compatibilidade
-- com o schema existente do App Ponto, onde o tipo pode variar).

CREATE TABLE IF NOT EXISTS public.agenda (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            UUID         NOT NULL REFERENCES public.clientes(id),
  funcionario_id        TEXT         NOT NULL,          -- employees.id do App Ponto
  cliente_servico_id    UUID         REFERENCES public.cliente_servicos(id),
  data_agendada         DATE         NOT NULL,
  hora_estimada_chegada TIME,
  duracao_estimada_min  INTEGER,
  ordem_rota            INTEGER      DEFAULT 0,         -- posição na rota do dia
  status                TEXT         NOT NULL DEFAULT 'rascunho'
                          CHECK (status IN ('rascunho','publicado','em_execucao','concluido','cancelado')),
  publicado_em          TIMESTAMPTZ,                    -- preenchido ao publicar
  observacoes_gestor    TEXT,                           -- instrução específica para esta visita
  created_by            UUID         REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 4. RELATORIOS ─────────────────────────────────────────────
-- Preenchido pelo funcionário no campo durante a visita.
-- Um agendamento tem exatamente um relatório.

CREATE TABLE IF NOT EXISTS public.relatorios (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id              UUID         NOT NULL REFERENCES public.agenda(id),
  funcionario_id              TEXT         NOT NULL,    -- employees.id do App Ponto
  checkin_at                  TIMESTAMPTZ,              -- hora de chegada (automática ao iniciar)
  checkin_lat                 DOUBLE PRECISION,
  checkin_lng                 DOUBLE PRECISION,
  checkout_at                 TIMESTAMPTZ,              -- hora de saída (automática ao finalizar)
  checkout_lat                DOUBLE PRECISION,
  checkout_lng                DOUBLE PRECISION,
  relato                      TEXT,                     -- descrição do que foi feito
  observacoes                 TEXT,                     -- observações gerais da visita
  assinatura_responsavel_nome TEXT,                     -- nome de quem assinou
  assinatura_responsavel_img  TEXT,                     -- URL da assinatura no Storage
  status                      TEXT         NOT NULL DEFAULT 'em_andamento'
                                CHECK (status IN ('em_andamento','concluido')),
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 5. FOTOS_RELATORIO ────────────────────────────────────────
-- Fotos tiradas durante a visita, cada uma com legenda opcional.
-- URLs apontam para o bucket 'field-photos' no Supabase Storage.

CREATE TABLE IF NOT EXISTS public.fotos_relatorio (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID        NOT NULL REFERENCES public.relatorios(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL,
  observacao   TEXT,
  tipo         TEXT        DEFAULT 'geral' CHECK (tipo IN ('antes','depois','geral')),
  ordem        INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. ÍNDICES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_ativo         ON public.clientes(ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_nome          ON public.clientes(nome_empresa);
CREATE INDEX IF NOT EXISTS idx_agend_data             ON public.agenda(data_agendada);
CREATE INDEX IF NOT EXISTS idx_agend_funcionario      ON public.agenda(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_agend_status           ON public.agenda(status);
CREATE INDEX IF NOT EXISTS idx_agend_cliente          ON public.agenda(cliente_id);
CREATE INDEX IF NOT EXISTS idx_relat_agendamento      ON public.relatorios(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_relat_funcionario      ON public.relatorios(funcionario_id);

-- ── 7. STORAGE BUCKET PARA FOTOS ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('field-photos', 'field-photos', false)
  ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "field_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "field_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "field_photos_delete" ON storage.objects;

CREATE POLICY "field_photos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'field-photos');

CREATE POLICY "field_photos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'field-photos');

CREATE POLICY "field_photos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'field-photos');

-- ── 8. ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE public.clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_servicos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_relatorio   ENABLE ROW LEVEL SECURITY;

-- Políticas iniciais: qualquer usuário autenticado acessa tudo.
-- Políticas granulares por role (gestor vs colaborador) serão
-- adicionadas quando a autenticação do CRM estiver implementada.

DROP POLICY IF EXISTS "clientes_auth_all"     ON public.clientes;
DROP POLICY IF EXISTS "servicos_auth_all"     ON public.cliente_servicos;
DROP POLICY IF EXISTS "agendamentos_auth_all" ON public.agenda;
DROP POLICY IF EXISTS "relatorios_auth_all"   ON public.relatorios;
DROP POLICY IF EXISTS "fotos_auth_all"        ON public.fotos_relatorio;

CREATE POLICY "clientes_auth_all"
  ON public.clientes FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "servicos_auth_all"
  ON public.cliente_servicos FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "agendamentos_auth_all"
  ON public.agenda FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "relatorios_auth_all"
  ON public.relatorios FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "fotos_auth_all"
  ON public.fotos_relatorio FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);
