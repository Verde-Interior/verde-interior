# Schema Supabase — Verde Interior

Referência técnica das tabelas, views, funções e políticas do banco.
Fonte de verdade: `apps/ponto/supabase/migrations/`.
Última atualização: 23/07/2026 (após migration 028 — estoque_patrimonios especie_id nullable).

---

## Como aplicar novas migrations

**Canal oficial: Supabase CLI.** Nunca mais pelo SQL Editor manual.

```bash
cd apps/ponto
supabase link --project-ref mcaqxfogzvrqqnoixptv   # só na primeira vez
supabase db push
```

Criar novo arquivo em `apps/ponto/supabase/migrations/NNN_descricao.sql` (incrementar número). Migrations do CRM entram no mesmo diretório porque é o mesmo projeto Supabase.

---

## Tabelas

### App Ponto (schema.sql inicial + 002, 003)

**`employees`** — colaboradores
- `id serial PK`, `name`, `cargo`, `contract_type` (CLT/PJ), `daily_hours` (int), métricas de horas (`bank_minutes`, `worked_hours`, `extra_hours`, `due_hours`, `days_worked`)
- RLS: leitura para authenticated; INSERT/UPDATE/DELETE só `is_gestor()`

**`profiles`** — vínculo `auth.users` ↔ `employees`
- `id uuid FK auth.users`, `employee_id FK employees`, `username unique`, `role text` (`colab` ou `gestor`)
- `email_recuperacao text` (018) — email para reset de senha
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
- `cli_id text` (019: `CLI-NNN`), `dias_disponiveis text[]`, `janela_entrada_inicio/fim`, `duracao_estimada_min` (007)
- 120 clientes importados (023); duplicados mergeados (024)
- RLS: `clientes_auth_all` (authenticated)

**`cliente_servicos`** — contratos ativos por cliente
- `id uuid PK`, `cliente_id FK`, `tipo_servico`, `frequencia`, `quantidade_vasos`, `valor_mensal`, `ativo`
- RLS: `servicos_auth_all`

**`agenda`** — visitas agendadas
- `id uuid PK`, `funcionario_id text`, `cliente_id FK clientes` (**nullable** desde 016), **`lead_id UUID FK leads(id) ON DELETE CASCADE`** (016), `data_agendada`, `hora_estimada_chegada TIME`, `duracao_estimada_min`, `ordem_rota INTEGER`, `status`, `observacoes_gestor`, `publicado_em`, `tipos_tarefa TEXT[]`
- Constraint `agenda_cliente_xor_lead` (016): exatamente um dos dois preenchido
- RLS: `agendamentos_auth_all`

**`relatorios`** / **`fotos_relatorio`** / **`employee_bloqueios`** — sem mudanças desde 012/010

### Auditoria (017)

**`audit_log`** — log imutável de INSERT/UPDATE/DELETE
- `id bigserial PK`, `entidade text`, `entidade_id text`, `acao text`, `usuario_id uuid`, `usuario_email text`, `payload_antes jsonb`, `payload_depois jsonb`, `criado_em timestamptz`
- RLS: só `is_gestor()` pode SELECT. INSERT via triggers `SECURITY DEFINER`. UPDATE/DELETE bloqueados.
- Triggers ativos em: `punch_records`, `justifications`

### Reset de Senha (018)

- Coluna `profiles.email_recuperacao text` adicionada
- Edge Function `admin-reset-password` criada (aguardando `supabase functions deploy` + SMTP no Supabase Auth)

### IDs Únicos + Ordens de Serviço (019)

**Sequências:** `seq_cliente_id`, `seq_orcamento_id`, `seq_os_id`

**`clientes.cli_id`** — `CLI-NNN`, preenchido por trigger ao inserir
**`leads.orc_id`** — `ORC-NNN`, preenchido por trigger ao inserir

**`ordens_servico`** — criada automaticamente quando lead muda para `orcamento_aprovado`
- `id uuid PK`, `os_id text` (`OS-NNN`), `lead_id FK leads`, `cliente_id FK clientes`, `status`, `criado_em`, `dados jsonb`

### CRM — Leads e Tarefas (015, 016)

**`leads`** — pipeline comercial
- Colunas core: `id uuid PK`, `orc_id text` (019), `empresa`, `contato`, `cargo`, `telefone`, `email`, `bairro`, `endereco`, `lat`, `lng`, `estagio_id`, **`tipos_servico TEXT[]`** (016), `tipo_servico` (DEPRECATED), `canal_origem`, etc.
- Coluna JSONB: `dados` — estado aninhado (`fluxoOrcamento`, `funilExecucao`, `historico`, `orcamentoAnexos`, `visitas`, `materiais`)
- RLS: `leads_auth_all`

**`tarefas`** — to-do do CRM
- `id uuid PK`, `titulo`, `prioridade`, `status`, `categoria`, `data_vencimento`, `lead_id FK leads`
- RLS: `tarefas_auth_all`

### Clientes — Grupos e Importação (022, 023, 024)

- **022** — grupos de serviço renomeados + campo `tem_orquidea boolean`
- **023** — import de 120 clientes da planilha
- **024** — merge de duplicados: clientes com mesmo nome mergeados, registros redundantes removidos

### Estoque v2 (025, 026, 027, 028)

**`estoque_especies`** — catálogo de espécies
- `id uuid PK`, `nome`, `nome_cientifico`, `categoria` (`interna`/`locacao`/`evento`/`outro`), `observacoes`, `ativo`, `criado_em`, `atualizado_em`
- 37 espécies cadastradas (026)
- RLS: `especies_auth_all`

**`estoque_patrimonios`** — plantas físicas individuais com QR
- `id uuid PK`, `qr_codigo text UNIQUE` (formato VI-xxxx — **imutável após criação**), `especie_id FK estoque_especies NULLABLE` (028), `status` (`disponivel`/`instalado`/`em_manutencao`/`descartado`), `cliente_id FK clientes NULLABLE`, `responsavel_id FK employees NULLABLE`, `observacoes`, `criado_em`, `atualizado_em`
- 260 patrimônios VI-0001→VI-0260 criados (026)
- RLS: `patrimonios_auth_all`

**`estoque_eventos`** — event sourcing (append-only, nada é deletado)
- `id uuid PK`, `patrimonio_id FK`, `tipo text` CHECK em 11 valores: `cadastro`, `entrada`, `saida`, `instalacao`, `retirada`, `troca_especie`, `manutencao_inicio`, `manutencao_fim`, `descarte`, `transferencia`, `observacao`
- `especie_anterior_id / especie_nova_id FK estoque_especies NULLABLE`, `cliente_id FK clientes NULLABLE`, `responsavel_id FK employees NULLABLE`, `observacoes`, `criado_em`
- RLS: `eventos_auth_all`

**`estoque_manutencoes`** — controle de manutenções abertas
- `id uuid PK`, `patrimonio_id FK UNIQUE` (só uma manutenção aberta por patrimônio), `evento_inicio_id FK estoque_eventos`, `responsavel_id FK employees NULLABLE`, `descricao`, `concluida_em`

**`estoque_itens`** — catálogo de insumos/vasos/materiais (substitui `materiais`)
- `id uuid PK`, `nome`, `categoria` (`insumo`/`vaso`/`material`), `unidade`, `sku`, `descricao`, `estoque_minimo`, `controla_posse boolean`, `ativo`
- RLS: `itens_auth_all`

**`estoque_itens_movs`** — movimentações de itens (substitui `estoque_movimentacoes`)
- `id uuid PK`, `item_id FK estoque_itens`, `tipo` (`entrada`/`saida`/`ajuste`/`perda`/`transferencia`), `quantidade`, `titular_id / titular_destino_id FK employees NULLABLE`, `motivo`, `agenda_id FK NULLABLE`, `cliente_id FK NULLABLE`, `criado_por`, `data timestamptz`, `observacao`

### Legado — deprecated mas mantidas (013)

**`materiais`** — dados migrados para `estoque_itens` (027). Mantida para não quebrar referências antigas.
**`estoque_movimentacoes`** — dados migrados para `estoque_itens_movs` (027). Mantida por compat.

---

## Views

**`estoque_patrimonios_view`** (025, atualizada em 028 para LEFT JOIN) — join de `estoque_patrimonios` com espécie e cliente. Usada pelo CRM para listar QR Codes e pelo `ModalAtribuirQR` (scan mobile).

**`estoque_especies_resumo`** (025) — por espécie: total, disponíveis, instalados, em manutenção, descartados. Derivado de `estoque_patrimonios`. Usada pela aba Plantas do Estoque.

**`estoque_itens_saldo_total`** (025) — saldo total por item com breakdown estoque vs com-colaboradores.

**`estoque_itens_saldo_titular`** (025) — saldo por (item, titular). NULL titular = estoque central.

~~`estoque_saldos_totais`~~ — **DROPADA em 027** (migrado para `estoque_itens_saldo_total`)
~~`estoque_saldos_por_titular`~~ — **DROPADA em 027** (migrado para `estoque_itens_saldo_titular`)

---

## Funções RPC

**`is_gestor() → boolean`** — retorna true se `auth.uid()` tem `role='gestor'` em `profiles`. `SECURITY DEFINER`.

**`my_employee_id() → int`** — retorna `employee_id` do perfil logado. `SECURITY DEFINER`.

**`set_updated_at() → trigger`** (015) — função genérica para setar `updated_at` em UPDATE.

**`audit_trigger() → trigger`** (017) — grava INSERT/UPDATE/DELETE em `audit_log`. `SECURITY DEFINER`. Anexar como trigger em qualquer tabela com:
```sql
CREATE TRIGGER foo_audit AFTER INSERT OR UPDATE OR DELETE ON foo FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
```

**`reorder_agenda(p_updates jsonb) → int`** (015) — Aplica múltiplos UPDATEs em `agenda` numa única transação. Substitui `Promise.all([...UPDATE...])` da EscalaCampo.

**`gerar_qr_codigo_patrimonio() → text`** (025) — gera o próximo código VI-xxxx usando `patrimonio_qr_seq`. Chamada via `supabase.rpc('gerar_qr_codigo_patrimonio')` no front-end ao criar novo patrimônio.

---

## Storage buckets

**`justifications`** (001) — anexos das justificativas (PDF, DOC, IMG).

**`field-photos`** (004) — fotos da visita (WebP ~50KB) + assinatura (PNG). Signed URLs 7-30 dias.

---

## Convenções

- **Nomes:** `snake_case` no banco, `camelCase` no JS.
- **IDs:** `uuid` para tabelas novas, `serial` para as legadas do Ponto.
- **funcionario_id:** sempre TEXT nas tabelas do Sistema de Campo (compat com `employees.id serial`).
- **RLS:** todas as tabelas têm `ENABLE ROW LEVEL SECURITY`. Padrão CRM: `_auth_all` (authenticated). Padrão Ponto: filtro por `my_employee_id() OR is_gestor()`.
- **`qr_codigo` dos patrimônios:** imutável após criação (VI-xxxx nunca muda). A espécie atribuída ao QR pode mudar.
- **Event sourcing no Estoque:** `estoque_eventos` é append-only. Status e espécie do patrimônio derivam dos eventos; nenhum evento é deletado.

---

## Verificação de saúde do banco

```sql
-- Confirmar que todas as tabelas públicas têm RLS habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Contagem de patrimônios por status
SELECT status, COUNT(*) FROM estoque_patrimonios GROUP BY status;

-- Patrimônios sem espécie atribuída
SELECT qr_codigo FROM estoque_patrimonios WHERE especie_id IS NULL ORDER BY qr_codigo;

-- Ver contagem de leads e tarefas
SELECT
  (SELECT COUNT(*) FROM leads)   AS leads,
  (SELECT COUNT(*) FROM tarefas) AS tarefas,
  (SELECT COUNT(*) FROM estoque_patrimonios) AS patrimonios;
```

---

## Ver também

- [[arquitetura-geral]] — visão geral da stack
- [[decisoes-importantes]] — log cronológico de decisões
- [[../04 - CRM Dashboard/README CRM Dashboard]] — como o CRM consome esse schema
- [[../02 - Ponto Eletrônico/README Ponto Eletrônico]] — como o Ponto consome esse schema
