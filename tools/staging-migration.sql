-- ============================================================
-- Verde Interior — Staging Migration
-- Gerado em 2026-07-27 a partir do schema de produção
-- ============================================================

-- ── Sequences ───────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.employees_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.punch_records_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.justifications_id_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_os_id START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_cliente_id START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_orcamento_id START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.patrimonio_qr_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.audit_log_id_seq START WITH 1;

-- ── Functions (sem dependência de tabelas) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gerar_qr_codigo_patrimonio() RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_num INTEGER;
BEGIN
  v_num := nextval('public.patrimonio_qr_seq');
  RETURN 'VI-' || LPAD(v_num::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_agenda(p_updates jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  item        JSONB;
  atualizados INTEGER := 0;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'p_updates precisa ser um array JSON';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE public.agenda
       SET funcionario_id        = COALESCE((item->>'funcionario_id')::TEXT,        funcionario_id),
           ordem_rota            = COALESCE((item->>'ordem_rota')::INTEGER,         ordem_rota),
           hora_estimada_chegada = COALESCE((item->>'hora_estimada_chegada')::TIME, hora_estimada_chegada)
     WHERE id = (item->>'id')::UUID;
    atualizados := atualizados + 1;
  END LOOP;
  RETURN atualizados;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   UUID;
  v_email TEXT;
  v_id    TEXT;
BEGIN
  BEGIN
    v_uid := auth.uid();
    v_email := (SELECT email FROM auth.users WHERE id = v_uid);
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL; v_email := NULL;
  END;
  IF TG_OP = 'DELETE' THEN
    v_id := (OLD.id)::TEXT;
    INSERT INTO public.audit_log (entidade, entidade_id, acao, usuario_id, usuario_email, payload_antes, payload_depois)
    VALUES (TG_TABLE_NAME, v_id, 'DELETE', v_uid, v_email, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := (NEW.id)::TEXT;
    IF to_jsonb(OLD) = to_jsonb(NEW) THEN RETURN NEW; END IF;
    INSERT INTO public.audit_log (entidade, entidade_id, acao, usuario_id, usuario_email, payload_antes, payload_depois)
    VALUES (TG_TABLE_NAME, v_id, 'UPDATE', v_uid, v_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_id := (NEW.id)::TEXT;
    INSERT INTO public.audit_log (entidade, entidade_id, acao, usuario_id, usuario_email, payload_antes, payload_depois)
    VALUES (TG_TABLE_NAME, v_id, 'INSERT', v_uid, v_email, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.trg_patrimonio_atualiza_ts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em := NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_orc_id_lead() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.orc_id IS NULL AND NEW.estagio_id IN ('orcamento_pendente','orcamento_enviado','orcamento_aprovado','orcamento_nao_aprovado') THEN
    NEW.orc_id := 'ORC-' || LPAD(nextval('public.seq_orcamento_id')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_os_de_lead_aprovado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estagio_id = 'orcamento_aprovado' AND (OLD.estagio_id IS DISTINCT FROM 'orcamento_aprovado') THEN
    IF NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE lead_id = NEW.id) THEN
      INSERT INTO public.ordens_servico (lead_id, cliente_id, origem, status, observacoes)
      VALUES (NEW.id, NEW.cliente_supabase_id, 'trigger_aprovacao', 'rascunho', 'OS gerada automaticamente ao aprovar o orçamento do lead.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Tables (em ordem de dependência) ────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id            integer DEFAULT nextval('employees_id_seq'::regclass) NOT NULL,
  name          text NOT NULL,
  cargo         text NOT NULL,
  contract_type text NOT NULL,
  daily_hours   integer DEFAULT 8 NOT NULL,
  bank_minutes  integer DEFAULT 0 NOT NULL,
  worked_hours  numeric DEFAULT 0 NOT NULL,
  extra_hours   numeric DEFAULT 0 NOT NULL,
  due_hours     numeric DEFAULT 0 NOT NULL,
  days_worked   integer DEFAULT 0 NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid NOT NULL,
  employee_id       integer,
  username          text NOT NULL,
  role              text DEFAULT 'colab' NOT NULL,
  email_recuperacao text
);

-- ── Functions que dependem de profiles ──────────────────────
CREATE OR REPLACE FUNCTION public.is_gestor() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'gestor');
$$;

CREATE OR REPLACE FUNCTION public.my_employee_id() RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$
  select employee_id from profiles where id = auth.uid();
$$;

CREATE TABLE IF NOT EXISTS public.punch_records (
  id          integer DEFAULT nextval('punch_records_id_seq'::regclass) NOT NULL,
  employee_id integer NOT NULL,
  date        date NOT NULL,
  type        text NOT NULL,
  "time"      text NOT NULL,
  obs         text,
  created_at  timestamptz DEFAULT now(),
  lat         double precision,
  lng         double precision
);

CREATE TABLE IF NOT EXISTS public.justifications (
  id          integer DEFAULT nextval('justifications_id_seq'::regclass) NOT NULL,
  employee_id integer NOT NULL,
  date        date NOT NULL,
  type        text NOT NULL,
  description text NOT NULL,
  status      text DEFAULT 'pendente' NOT NULL,
  created_at  timestamptz DEFAULT now(),
  files       text[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id                    uuid DEFAULT gen_random_uuid() NOT NULL,
  nome_empresa          text NOT NULL,
  cnpj                  text,
  razao_social          text,
  contato_nome          text,
  contato_telefone      text,
  contato_email         text,
  endereco              text NOT NULL,
  complemento           text,
  lat                   double precision NOT NULL,
  lng                   double precision NOT NULL,
  bairro                text,
  dias_disponiveis      text[] DEFAULT ARRAY[]::text[],
  janela_entrada_inicio time,
  janela_entrada_fim    time,
  duracao_estimada_min  integer,
  grupo_servico         text,
  observacoes           text,
  observacoes_internas  text,
  ativo                 boolean DEFAULT true NOT NULL,
  data_inicio_contrato  date,
  ultima_visita         date,
  data_cadastro         date,
  created_at            timestamptz DEFAULT now() NOT NULL,
  frequencia_visita     text,
  cli_id                text DEFAULT ('CLI-' || lpad((nextval('seq_cliente_id'::regclass))::text, 3, '0')),
  tem_orquidea          boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cliente_servicos (
  id              uuid DEFAULT gen_random_uuid() NOT NULL,
  cliente_id      uuid NOT NULL,
  tipo_servico    text NOT NULL,
  frequencia      text NOT NULL,
  quantidade_vasos integer,
  valor_mensal    numeric,
  ativo           boolean DEFAULT true NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.leads (
  id                 uuid DEFAULT gen_random_uuid() NOT NULL,
  empresa            text NOT NULL,
  contato            text,
  cargo              text,
  telefone           text,
  email              text,
  bairro             text,
  endereco           text,
  lat                numeric,
  lng                numeric,
  estagio_id         text DEFAULT 'contato_recebido' NOT NULL,
  tipo_servico       text,
  canal_origem       text,
  quantidade_vasos   integer,
  valor_estimado     numeric,
  frequencia_visita  text,
  data_entrada       date DEFAULT CURRENT_DATE,
  ultimo_contato     date,
  proximo_follow_up  date,
  responsavel        text,
  observacoes        text,
  motivo_perda       text,
  cliente_supabase_id uuid,
  dados              jsonb DEFAULT '{}' NOT NULL,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  tipos_servico      text[] DEFAULT '{}' NOT NULL,
  orc_id             text
);

CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id           uuid DEFAULT gen_random_uuid() NOT NULL,
  os_id        text DEFAULT ('OS-' || lpad((nextval('seq_os_id'::regclass))::text, 3, '0')) NOT NULL,
  lead_id      uuid,
  cliente_id   uuid,
  origem       text DEFAULT 'manual',
  status       text DEFAULT 'rascunho',
  observacoes  text,
  criada_em    timestamptz DEFAULT now(),
  concluida_em timestamptz
);

CREATE TABLE IF NOT EXISTS public.tarefas (
  id             uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo         text NOT NULL,
  descricao      text,
  prioridade     text DEFAULT 'media' NOT NULL,
  status         text DEFAULT 'a_fazer' NOT NULL,
  categoria      text DEFAULT 'geral' NOT NULL,
  data_vencimento date,
  data_criacao   date DEFAULT CURRENT_DATE,
  concluida_em   date,
  lead_id        uuid,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agenda (
  id                    uuid DEFAULT gen_random_uuid() NOT NULL,
  cliente_id            uuid,
  funcionario_id        text NOT NULL,
  cliente_servico_id    uuid,
  data_agendada         date NOT NULL,
  hora_estimada_chegada time,
  duracao_estimada_min  integer,
  ordem_rota            integer DEFAULT 0,
  status                text DEFAULT 'rascunho' NOT NULL,
  publicado_em          timestamptz,
  observacoes_gestor    text,
  created_by            uuid,
  created_at            timestamptz DEFAULT now() NOT NULL,
  tipos_tarefa          text[] DEFAULT '{}',
  lead_id               uuid
);

CREATE TABLE IF NOT EXISTS public.relatorios (
  id                          uuid DEFAULT gen_random_uuid() NOT NULL,
  agendamento_id              uuid NOT NULL,
  funcionario_id              text NOT NULL,
  checkin_at                  timestamptz,
  checkin_lat                 double precision,
  checkin_lng                 double precision,
  checkout_at                 timestamptz,
  checkout_lat                double precision,
  checkout_lng                double precision,
  relato                      text,
  observacoes                 text,
  assinatura_responsavel_nome text,
  assinatura_responsavel_img  text,
  status                      text DEFAULT 'em_andamento' NOT NULL,
  created_at                  timestamptz DEFAULT now() NOT NULL,
  assinatura_storage_path     text
);

CREATE TABLE IF NOT EXISTS public.fotos_relatorio (
  id           uuid DEFAULT gen_random_uuid() NOT NULL,
  relatorio_id uuid NOT NULL,
  url          text NOT NULL,
  observacao   text,
  tipo         text DEFAULT 'geral',
  ordem        integer DEFAULT 0,
  created_at   timestamptz DEFAULT now() NOT NULL,
  storage_path text
);

CREATE TABLE IF NOT EXISTS public.checkin_cancelados (
  id             uuid DEFAULT gen_random_uuid() NOT NULL,
  agendamento_id uuid NOT NULL,
  funcionario_id text NOT NULL,
  checkin_at     timestamptz NOT NULL,
  checkin_lat    double precision,
  checkin_lng    double precision,
  cancelado_at   timestamptz DEFAULT now() NOT NULL,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_bloqueios (
  id             uuid DEFAULT gen_random_uuid() NOT NULL,
  funcionario_id text NOT NULL,
  data_inicio    date NOT NULL,
  data_fim       date NOT NULL,
  motivo         text,
  created_by     text,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.materiais (
  id               uuid DEFAULT gen_random_uuid() NOT NULL,
  nome             text NOT NULL,
  categoria        text NOT NULL,
  unidade          text NOT NULL,
  sku              text,
  descricao        text,
  foto_url         text,
  estoque_minimo   numeric DEFAULT 0,
  controla_posse   boolean DEFAULT false NOT NULL,
  ativo            boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estoque_especies (
  id              uuid DEFAULT gen_random_uuid() NOT NULL,
  nome            text NOT NULL,
  nome_cientifico text,
  categoria       text,
  ativo           boolean DEFAULT true,
  observacoes     text,
  criado_em       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id               uuid DEFAULT gen_random_uuid() NOT NULL,
  categoria        text NOT NULL,
  nome             text NOT NULL,
  unidade          text NOT NULL,
  sku              text,
  descricao        text,
  foto_url         text,
  estoque_minimo   numeric DEFAULT 0,
  controla_posse   boolean DEFAULT false NOT NULL,
  ativo            boolean DEFAULT true,
  criado_em        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estoque_patrimonios (
  id                 uuid DEFAULT gen_random_uuid() NOT NULL,
  qr_codigo          text NOT NULL,
  especie_id         uuid,
  cliente_id         uuid,
  status             text DEFAULT 'disponivel' NOT NULL,
  localizacao_interna text,
  observacoes        text,
  criado_em          timestamptz DEFAULT now(),
  atualizado_em      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estoque_eventos (
  id                 uuid DEFAULT gen_random_uuid() NOT NULL,
  patrimonio_id      uuid NOT NULL,
  tipo               text NOT NULL,
  funcionario_id     integer,
  cliente_id         uuid,
  especie_anterior_id uuid,
  especie_nova_id    uuid,
  observacoes        text,
  foto_url           text,
  dados_extra        jsonb DEFAULT '{}',
  criado_em          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estoque_manutencoes (
  id                        uuid DEFAULT gen_random_uuid() NOT NULL,
  patrimonio_id             uuid NOT NULL,
  tipo                      text NOT NULL,
  motivo                    text,
  funcionario_responsavel_id integer,
  iniciada_em               timestamptz DEFAULT now(),
  prevista_conclusao        date,
  concluida_em              timestamptz,
  observacoes               text,
  status                    text DEFAULT 'aberta' NOT NULL
);

CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id                  uuid DEFAULT gen_random_uuid() NOT NULL,
  material_id         uuid NOT NULL,
  tipo                text NOT NULL,
  quantidade          numeric NOT NULL,
  titular_id          integer,
  titular_destino_id  integer,
  motivo              text,
  agenda_id           uuid,
  cliente_id          uuid,
  criado_por          text,
  data                timestamptz DEFAULT now(),
  observacao          text
);

CREATE TABLE IF NOT EXISTS public.estoque_itens_movs (
  id                 uuid DEFAULT gen_random_uuid() NOT NULL,
  item_id            uuid NOT NULL,
  tipo               text NOT NULL,
  quantidade         numeric NOT NULL,
  titular_id         integer,
  titular_destino_id integer,
  motivo             text,
  agenda_id          uuid,
  cliente_id         uuid,
  criado_por         text,
  observacao         text,
  criado_em          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id             bigint DEFAULT nextval('audit_log_id_seq'::regclass) NOT NULL,
  entidade       text NOT NULL,
  entidade_id    text NOT NULL,
  acao           text NOT NULL,
  usuario_id     uuid,
  usuario_email  text,
  payload_antes  jsonb,
  payload_depois jsonb,
  criado_em      timestamptz DEFAULT now()
);

-- ── Primary Keys ─────────────────────────────────────────────
ALTER TABLE public.employees        ADD PRIMARY KEY (id);
ALTER TABLE public.profiles         ADD PRIMARY KEY (id);
ALTER TABLE public.punch_records    ADD PRIMARY KEY (id);
ALTER TABLE public.justifications   ADD PRIMARY KEY (id);
ALTER TABLE public.clientes         ADD PRIMARY KEY (id);
ALTER TABLE public.cliente_servicos ADD PRIMARY KEY (id);
ALTER TABLE public.leads            ADD PRIMARY KEY (id);
ALTER TABLE public.ordens_servico   ADD PRIMARY KEY (id);
ALTER TABLE public.tarefas          ADD PRIMARY KEY (id);
ALTER TABLE public.agenda           ADD PRIMARY KEY (id);
ALTER TABLE public.relatorios       ADD PRIMARY KEY (id);
ALTER TABLE public.fotos_relatorio  ADD PRIMARY KEY (id);
ALTER TABLE public.checkin_cancelados ADD PRIMARY KEY (id);
ALTER TABLE public.employee_bloqueios ADD PRIMARY KEY (id);
ALTER TABLE public.materiais        ADD PRIMARY KEY (id);
ALTER TABLE public.estoque_especies ADD PRIMARY KEY (id);
ALTER TABLE public.estoque_itens    ADD PRIMARY KEY (id);
ALTER TABLE public.estoque_patrimonios ADD PRIMARY KEY (id);
ALTER TABLE public.estoque_eventos  ADD PRIMARY KEY (id);
ALTER TABLE public.estoque_manutencoes ADD PRIMARY KEY (id);
ALTER TABLE public.estoque_movimentacoes ADD PRIMARY KEY (id);
ALTER TABLE public.estoque_itens_movs ADD PRIMARY KEY (id);
ALTER TABLE public.audit_log        ADD PRIMARY KEY (id);

-- ── Foreign Keys ─────────────────────────────────────────────
ALTER TABLE public.profiles         ADD FOREIGN KEY (employee_id) REFERENCES public.employees(id);
ALTER TABLE public.punch_records    ADD FOREIGN KEY (employee_id) REFERENCES public.employees(id);
ALTER TABLE public.justifications   ADD FOREIGN KEY (employee_id) REFERENCES public.employees(id);
ALTER TABLE public.cliente_servicos ADD FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.leads            ADD FOREIGN KEY (cliente_supabase_id) REFERENCES public.clientes(id);
ALTER TABLE public.ordens_servico   ADD FOREIGN KEY (lead_id) REFERENCES public.leads(id);
ALTER TABLE public.ordens_servico   ADD FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.tarefas          ADD FOREIGN KEY (lead_id) REFERENCES public.leads(id);
ALTER TABLE public.agenda           ADD FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.agenda           ADD FOREIGN KEY (cliente_servico_id) REFERENCES public.cliente_servicos(id);
ALTER TABLE public.agenda           ADD FOREIGN KEY (lead_id) REFERENCES public.leads(id);
ALTER TABLE public.relatorios       ADD FOREIGN KEY (agendamento_id) REFERENCES public.agenda(id);
ALTER TABLE public.fotos_relatorio  ADD FOREIGN KEY (relatorio_id) REFERENCES public.relatorios(id);
ALTER TABLE public.checkin_cancelados ADD FOREIGN KEY (agendamento_id) REFERENCES public.agenda(id);
ALTER TABLE public.estoque_patrimonios ADD FOREIGN KEY (especie_id) REFERENCES public.estoque_especies(id);
ALTER TABLE public.estoque_patrimonios ADD FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.estoque_eventos  ADD FOREIGN KEY (patrimonio_id) REFERENCES public.estoque_patrimonios(id);
ALTER TABLE public.estoque_eventos  ADD FOREIGN KEY (funcionario_id) REFERENCES public.employees(id);
ALTER TABLE public.estoque_eventos  ADD FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.estoque_eventos  ADD FOREIGN KEY (especie_anterior_id) REFERENCES public.estoque_especies(id);
ALTER TABLE public.estoque_eventos  ADD FOREIGN KEY (especie_nova_id) REFERENCES public.estoque_especies(id);
ALTER TABLE public.estoque_manutencoes ADD FOREIGN KEY (patrimonio_id) REFERENCES public.estoque_patrimonios(id);
ALTER TABLE public.estoque_manutencoes ADD FOREIGN KEY (funcionario_responsavel_id) REFERENCES public.employees(id);
ALTER TABLE public.estoque_movimentacoes ADD FOREIGN KEY (material_id) REFERENCES public.materiais(id);
ALTER TABLE public.estoque_movimentacoes ADD FOREIGN KEY (titular_id) REFERENCES public.employees(id);
ALTER TABLE public.estoque_movimentacoes ADD FOREIGN KEY (titular_destino_id) REFERENCES public.employees(id);
ALTER TABLE public.estoque_movimentacoes ADD FOREIGN KEY (agenda_id) REFERENCES public.agenda(id);
ALTER TABLE public.estoque_movimentacoes ADD FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.estoque_itens_movs ADD FOREIGN KEY (item_id) REFERENCES public.estoque_itens(id);
ALTER TABLE public.estoque_itens_movs ADD FOREIGN KEY (titular_id) REFERENCES public.employees(id);
ALTER TABLE public.estoque_itens_movs ADD FOREIGN KEY (titular_destino_id) REFERENCES public.employees(id);
ALTER TABLE public.estoque_itens_movs ADD FOREIGN KEY (agenda_id) REFERENCES public.agenda(id);
ALTER TABLE public.estoque_itens_movs ADD FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_servicos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_relatorio    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_cancelados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bloqueios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_especies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_patrimonios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_eventos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_itens_movs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

-- employees
CREATE POLICY "read employees"   ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (is_gestor());
CREATE POLICY "update employees" ON public.employees FOR UPDATE TO authenticated USING (is_gestor());
CREATE POLICY "delete employees" ON public.employees FOR DELETE TO authenticated USING (is_gestor());
-- profiles
CREATE POLICY "read profiles" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()) OR is_gestor());
CREATE POLICY "anon"          ON public.profiles FOR SELECT TO anon USING (email_recuperacao IS NOT NULL);
-- punch_records
CREATE POLICY "read punch_records"   ON public.punch_records FOR SELECT TO authenticated USING ((employee_id = my_employee_id()) OR is_gestor());
CREATE POLICY "insert punch_records" ON public.punch_records FOR INSERT TO authenticated WITH CHECK ((employee_id = my_employee_id()) OR is_gestor());
CREATE POLICY "update punch_records" ON public.punch_records FOR UPDATE TO authenticated USING ((employee_id = my_employee_id()) OR is_gestor());
CREATE POLICY "delete punch_records" ON public.punch_records FOR DELETE TO authenticated USING (is_gestor());
-- justifications
CREATE POLICY "read justifications"   ON public.justifications FOR SELECT TO authenticated USING ((employee_id = my_employee_id()) OR is_gestor());
CREATE POLICY "insert justifications" ON public.justifications FOR INSERT TO authenticated WITH CHECK ((employee_id = my_employee_id()) OR is_gestor());
CREATE POLICY "update justifications" ON public.justifications FOR UPDATE TO authenticated USING (is_gestor());
CREATE POLICY "delete justifications" ON public.justifications FOR DELETE TO authenticated USING ((employee_id = my_employee_id()) OR is_gestor());
-- audit_log
CREATE POLICY "audit_log_gestor_read" ON public.audit_log FOR SELECT TO authenticated USING (is_gestor());
-- all-authenticated policies
CREATE POLICY "agendamentos_auth_all"  ON public.agenda             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "relatorios_auth_all"    ON public.relatorios         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fotos_auth_all"         ON public.fotos_relatorio    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clientes_auth_all"      ON public.clientes           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "servicos_auth_all"      ON public.cliente_servicos   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "leads_auth_all"         ON public.leads              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ordens_servico_auth_all" ON public.ordens_servico    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tarefas_auth_all"       ON public.tarefas            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bloqueios_auth_all"     ON public.employee_bloqueios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "materiais_auth_all"     ON public.materiais          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "especies_auth_all"      ON public.estoque_especies   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "itens_auth_all"         ON public.estoque_itens      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "patrimonios_auth_all"   ON public.estoque_patrimonios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "eventos_auth_all"       ON public.estoque_eventos    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manutencoes_auth_all"   ON public.estoque_manutencoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mov_auth_all"           ON public.estoque_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "itens_movs_auth_all"    ON public.estoque_itens_movs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados podem ver"    ON public.checkin_cancelados FOR SELECT TO authenticated USING (true);
CREATE POLICY "autenticados podem inserir" ON public.checkin_cancelados FOR INSERT TO authenticated WITH CHECK (true);

-- ── Triggers ─────────────────────────────────────────────────
CREATE TRIGGER justifications_audit  AFTER INSERT OR UPDATE OR DELETE ON public.justifications  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER punch_records_audit   AFTER INSERT OR UPDATE OR DELETE ON public.punch_records   FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER leads_set_updated_at  BEFORE UPDATE ON public.leads  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tarefas_set_updated_at BEFORE UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_gerar_orc_id      BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.gerar_orc_id_lead();
CREATE TRIGGER trg_gerar_os_de_lead_aprovado AFTER UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.gerar_os_de_lead_aprovado();
CREATE TRIGGER trg_patrimonio_atualizado_em  BEFORE UPDATE ON public.estoque_patrimonios FOR EACH ROW EXECUTE FUNCTION public.trg_patrimonio_atualiza_ts();
