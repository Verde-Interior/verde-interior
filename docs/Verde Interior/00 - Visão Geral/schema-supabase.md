# Schema Supabase — Verde Interior

Referência técnica das tabelas, views, funções e políticas do banco.
Fonte de verdade: `apps/ponto/supabase/migrations/`.
Última atualização: 20/07/2026 (após migration 017 — audit_log).

---

## Como aplicar novas migrations

1. Abrir o dashboard do Supabase → **SQL Editor** → **New query**
2. Copiar o conteúdo de `apps/ponto/supabase/migrations/NNN_*.sql`
3. Rodar
4. Confirmar no **Table Editor** ou **Database → Tables** que o resultado apareceu

Numeração: incrementar sempre a partir da última migration existente. As migrations do CRM entram no mesmo diretório porque é o mesmo projeto Supabase.

---

## Tabelas

### App Ponto (schema.sql inicial + 002, 003)

**`employees`** — colaboradores
- `id serial PK`, `name`, `cargo`, `contract_type` (CLT/PJ), `daily_hours` (int), métricas de horas (`bank_minutes`, `worked_hours`, `extra_hours`, `due_hours`, `days_worked`)
- RLS: leitura para authenticated; INSERT/UPDATE/DELETE só `is_gestor()`

**`profiles`** — vínculo `auth.users` ↔ `employees`
- `id uuid FK auth.users`, `employee_id FK employees`, `username unique`, `role text` (`colab` ou `gestor`)
- RLS: leitura só do próprio ou de gestor

**`punch_records`** — batidas de ponto
- `id serial PK`, `employee_id FK`, `date`, `type` (`entry`/`break`/`return`/`exit`), `time text`, `obs`, `lat numeric`, `lng numeric` (003)
- RLS: CRUD só do próprio ou de gestor. DELETE restrito a gestor via `002_restrict_punch_delete.sql`

**`justifications`** — ocorrências (atraso, falta, saída antecipada…)
- `id serial PK`, `employee_id FK`, `date`, `type`, `description`, `status` (`pendente`/`aprovado`/`recusado`), `files text[]` (001)
- RLS: leitura/inserção do próprio ou gestor. UPDATE só gestor. DELETE do próprio ou gestor.

### Sistema de Campo — CRM + Ponto (004_clientes_sistema_campo.sql, 007, 008, 010, 012, 014)

**`clientes`** — carteira de clientes
- `id uuid PK`, `nome_empresa`, `contato_nome/telefone/email`, `endereco`, `bairro`, `lat/lng`, `observacoes`, `grupo_servico`, `frequencia_visita` (011: `1x_semana`/`quinzenal`/`mensal`/`sem_frequencia`), `ultima_visita`, `ativo`, `data_inicio_contrato`
- Contém colunas granulares em (007): `dias_disponiveis text[]`, `janela_entrada_inicio/fim`, `duracao_estimada_min`
- RLS: `clientes_auth_all` (authenticated)

**`cliente_servicos`** — contratos ativos por cliente
- `id uuid PK`, `cliente_id FK`, `tipo_servico`, `frequencia`, `quantidade_vasos`, `valor_mensal`, `ativo`
- RLS: `servicos_auth_all`

**`agenda`** — visitas agendadas
- `id uuid PK`, `funcionario_id text` (= `employees.id`, texto para compat com Ponto), `cliente_id FK clientes` (**nullable** desde 016), **`lead_id UUID FK leads(id) ON DELETE CASCADE`** (016), `data_agendada`, `hora_estimada_chegada TIME`, `duracao_estimada_min`, `ordem_rota INTEGER`, `status` (`rascunho`/`publicado`/`em_execucao`/`concluido`/`cancelado`), `observacoes_gestor`, `publicado_em`, `tipos_tarefa TEXT[]` (014: multi-select `manutencao`/`troca`/`reforma`/`evento`/`outro`)
- Constraint `agenda_cliente_xor_lead` (016): `(cliente_id IS NOT NULL AND lead_id IS NULL) OR (cliente_id IS NULL AND lead_id IS NOT NULL)`. Exatamente um dos dois preenchido.
- RLS: `agendamentos_auth_all`
- Índice: `idx_agend_funcionario`, `idx_agend_status`, `idx_agenda_lead` (016)

**`relatorios`** — relatório de execução da visita
- `id uuid PK` (constraint `uq_relat_agendamento_id` unique em 012), `agendamento_id FK`, `funcionario_id text`, `checkin_at`, `checkin_lat/lng`, `checkout_at`, `checkout_lat/lng`, `status` (`em_andamento`/`concluido`), `relato`, `observacoes`, `assinatura_responsavel_nome`, `assinatura_responsavel_img`, `assinatura_storage_path` (008)
- RLS: `relatorios_auth_all`

**`fotos_relatorio`** — fotos da visita (WebP no bucket `field-photos`)
- `id uuid PK`, `relatorio_id FK`, `url`, `storage_path`, `observacao`, `tipo`, `ordem`
- RLS: `fotos_auth_all`

**`employee_bloqueios`** (010) — dias em que colaborador não pode receber visita
- `id uuid PK`, `funcionario_id text`, `data_inicio`, `data_fim`, `motivo`, `criado_em`
- RLS: `bloqueios_auth_all`
- Índice: `(funcionario_id, data_inicio, data_fim)`

### Estoque (013_materiais_estoque.sql)

**`materiais`** — catálogo
- `id uuid PK`, `nome`, `categoria` (`vaso`/`planta`/`cobertura`/`substrato`/`adubo`/`ferramenta`/`outro`), `unidade` (`un`/`kg`/`L`/`m`/`saco`/`frasco`/`rolo`), `sku`, `descricao`, `foto_url`, `estoque_minimo`, `controla_posse boolean` (ferramentas), `ativo`
- RLS: `materiais_auth_all`

**`estoque_movimentacoes`** — livro razão
- `id uuid PK`, `material_id FK`, `tipo` (`entrada`/`saida`/`ajuste`/`perda`/`transferencia`), `quantidade`, `titular_id/titular_destino_id FK employees`, `motivo`, `agenda_id FK`, `cliente_id FK`, `criado_por`, `data timestamptz`, `observacao`
- Constraints: transferência exige destino e não pode ter mesma origem/destino
- RLS: `mov_auth_all`

### Auditoria (017_audit_log_ponto.sql)

**`audit_log`** — log imutável de INSERT/UPDATE/DELETE em tabelas críticas
- `id bigserial PK`, `entidade text` (nome da tabela), `entidade_id text`, `acao text` (`INSERT`/`UPDATE`/`DELETE`), `usuario_id uuid` (auth.uid()), `usuario_email text`, `payload_antes jsonb`, `payload_depois jsonb`, `criado_em timestamptz`
- Índices: `(entidade, entidade_id)`, `(usuario_id)`, `(criado_em DESC)`
- RLS: só `is_gestor()` pode SELECT. INSERT vem só de triggers (`SECURITY DEFINER`). UPDATE/DELETE bloqueados (log imutável).
- Triggers ativos em: `punch_records`, `justifications`. Adicionar em outra tabela: `CREATE TRIGGER foo_audit AFTER INSERT OR UPDATE OR DELETE ON foo FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()`.

### CRM — Leads e Tarefas (015_crm_leads_tarefas.sql, migração desta sprint)

**`leads`** — pipeline comercial
- Colunas core: `id uuid PK`, `empresa`, `contato`, `cargo`, `telefone`, `email`, `bairro`, `endereco`, `lat`, `lng`, `estagio_id` (check em 5 valores), **`tipos_servico TEXT[]`** (016 — array de valores válidos), `tipo_servico` (DEPRECATED, mantido para compat), `canal_origem` (`WhatsApp`/`E-mail`/`Telefone`), `quantidade_vasos`, `valor_estimado`, `frequencia_visita`, `data_entrada`, `ultimo_contato`, `proximo_follow_up`, `responsavel`, `observacoes`, `motivo_perda`, `cliente_supabase_id FK clientes`
- Coluna JSONB: `dados` — armazena estado aninhado (`fluxoOrcamento`, `funilExecucao`, `historico`, `orcamentoAnexos`, `visitas`, `materiais`). Permite evolução sem migration por campo.
- Trigger `leads_set_updated_at`: mantém `updated_at`
- Constraint `leads_tipos_servico_valid`: `tipos_servico <@ ARRAY['venda','manutencao','reforma','locacao','locacao_evento']`
- Índice GIN `idx_leads_tipos_servico` (para filtros do tipo `@>`)
- RLS: `leads_auth_all`

**`tarefas`** — to-do do CRM
- `id uuid PK`, `titulo`, `descricao`, `prioridade` (`alta`/`media`/`baixa`), `status` (`a_fazer`/`em_andamento`/`concluida`), `categoria`, `data_vencimento`, `data_criacao`, `concluida_em`, `lead_id FK leads` (ON DELETE SET NULL)
- Trigger `tarefas_set_updated_at`
- RLS: `tarefas_auth_all`

---

## Views

**`estoque_saldos_por_titular`** (013) — saldo por (material, titular). NULL titular = estoque central.
**`estoque_saldos_totais`** (013) — saldo total por material com breakdown estoque vs com-colaboradores + `ultima_mov`.

---

## Funções RPC

**`is_gestor() → boolean`** (schema.sql) — retorna true se o `auth.uid()` tem `role='gestor'` em `profiles`. `SECURITY DEFINER`.

**`my_employee_id() → int`** (schema.sql) — retorna `employee_id` do perfil logado. `SECURITY DEFINER`.

**`set_updated_at() → trigger`** (015) — função genérica para setar `updated_at` em UPDATE.

**`audit_trigger() → trigger`** (017) — grava INSERT/UPDATE/DELETE em `audit_log` com snapshot antes/depois em JSONB. `SECURITY DEFINER` para conseguir escrever mesmo quando o usuário não tem privilégio direto em `audit_log`. Anexar como trigger em qualquer tabela.

**`reorder_agenda(p_updates jsonb) → int`** (015) — Aplica múltiplos UPDATEs em `agenda` numa única transação. Aceita `funcionario_id`, `ordem_rota`, `hora_estimada_chegada` por item (campos ausentes preservam valor atual via COALESCE). Substitui os `Promise.all([...UPDATE...])` do EscalaCampo e elimina race condition do drag & drop e do otimizador de rota. `SECURITY INVOKER`.

Uso do lado do cliente:
```js
await supabase.rpc('reorder_agenda', {
  p_updates: [
    { id: 'uuid-1', funcionario_id: '3', ordem_rota: 0 },
    { id: 'uuid-2', ordem_rota: 1, hora_estimada_chegada: '09:30' },
  ]
});
```

---

## Storage buckets

**`justifications`** (001) — anexos das justificativas (PDF, DOC, IMG). Só authenticated pode INSERT/SELECT/DELETE.

**`field-photos`** (004) — fotos da visita (WebP ~50KB) + assinatura (PNG). Signed URLs 7-30 dias. Só authenticated após remoção da anon policy em 011.

---

## Convenções

- **Nomes:** `snake_case` no banco, `camelCase` no JS. Mapeamento em `CRMContext.jsx` via `leadToRow` / `rowToLead` / `tarefaToRow` / `rowToTarefa`.
- **IDs:** `uuid` para tabelas novas, `serial` para as legadas do Ponto (`employees`, `punch_records`, `justifications`).
- **funcionario_id:** sempre TEXT nas tabelas do Sistema de Campo (compat com `employees.id serial`, mas o Ponto usa via string).
- **RLS:** todas as tabelas têm `ENABLE ROW LEVEL SECURITY`. Padrão do CRM é `_auth_all` (authenticated, sem filtro por role) porque só gestores usam. Padrão do Ponto é filtro por `my_employee_id() OR is_gestor()`.
- **Estados aninhados:** preferir JSONB (`leads.dados`) a criar tabelas relacionais para dados que evoluem rápido e são sempre lidos junto com o registro pai.

---

## Verificação de saúde do banco

Rodar no SQL Editor de tempos em tempos para pegar regressões:

```sql
-- Confirmar que todas as tabelas públicas têm RLS habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Listar policies existentes por tabela
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Ver contagem de leads e tarefas (deve ser > 0 após uso real)
SELECT
  (SELECT COUNT(*) FROM leads)   AS leads,
  (SELECT COUNT(*) FROM tarefas) AS tarefas;
```

---

## Ver também

- [[arquitetura-geral]] — visão geral da stack
- [[decisoes-importantes]] — log cronológico de decisões (incluindo as desta sprint)
- [[../04 - CRM Dashboard/README CRM Dashboard]] — como o CRM consome esse schema
- [[../02 - Ponto Eletrônico/README Ponto Eletrônico]] — como o Ponto consome esse schema
