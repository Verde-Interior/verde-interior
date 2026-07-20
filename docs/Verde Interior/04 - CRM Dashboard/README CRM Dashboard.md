# CRM / Dashboard — Status Atual

**Status:** ✅ Deployado e operacional
**Stack:** React 18 + Vite (JavaScript puro)
**Pasta local:** `apps/crm/`
**Última atualização da doc:** 20/07/2026

---

## Módulos operacionais (9)

| Módulo | Estado | Persistência |
|---|---|---|
| Dashboard | ✅ Operacional (KPIs, range de datas, atalhos) | Supabase (agenda, clientes, relatórios) |
| **Pipeline / Kanban** | ✅ Funil de vendas com 5 estágios | ⚠️ `localStorage` — migração pendente |
| **Tarefas** | ✅ CRUD com prioridade, categoria, vínculo com lead | ⚠️ `localStorage` — migração pendente |
| Funil de Execução | ✅ Kanban pós-aprovação (materiais → pós-venda) | Supabase (estoque, employees) + leads via context |
| Clientes | ✅ CRUD com dias disponíveis, janelas, frequência, completude | Supabase (`clientes`, `cliente_servicos`) |
| Escala de Campo | ✅ Fase 5.2 nível 2 (otimizador, drag & drop, tooltips, bloqueios) | Supabase (`agenda`, `employees`, `employee_bloqueios`) |
| Relatórios | ✅ Fase 4 (fotos, assinatura, GPS, reverse geocoding) | Supabase (`relatorios`, `fotos_relatorio`, storage) |
| Agenda | ✅ Calendário + sidebar | Supabase (`agenda`) |
| Estoque | 🟡 Etapa 1 apenas (lista + KPIs read-only) | Supabase (`estoque_saldos_totais`) |

Também presentes: `GlobalSearch` (Cmd+K), `Configurações`, `AddLeadModal` com validação de duplicata, `ModalOrcamento` com histórico de atividades e ciclo completo de aprovação.

---

## Funil de vendas (Pipeline / Kanban)

1. Contato Recebido
2. Orçamento Pendente
3. Orçamento Enviado
4. Aprovado → dispara `promoverParaCliente()` (cria registro no Supabase `clientes` + `cliente_servicos`)
5. Não Aprovado — **motivo obrigatório** (Preço, Concorrente, IA, Suspenso)

Filtros disponíveis: busca, tipo de serviço, canal, ordenação (5 modos).

## Funil de Execução

Kanban pós-aprovação, 5 etapas: materiais → agendamento → execução → pós-venda.
Integração com estoque para alertar materiais faltantes.

---

## Autenticação (já implementada)

- `AuthContext.jsx` → `supabase.auth.signInWithPassword()` (email `{user}@vi.app`)
- Session: `user.id`, `user.email`, `user_metadata.username`, `user_metadata.role` (default `colab`)
- `AppGate` renderiza `<Login />` se não houver sessão
- Policies anônimas removidas em 07/2026 (commit `9a94f7c`)

**Pendente:** proteção granular de rotas por role (hoje qualquer usuário autenticado acessa todas as views).

---

## Persistência — mapa real

**Ainda em localStorage:**
- `crm-verde-leads` (leads do pipeline)
- `crm-verde-tarefas`
- `crm-font-scale`, `crm-nome-usuario`, `crm-notif-*`, `crm-metas` (preferências)

**No Supabase (leitura + escrita):**
- `clientes`, `cliente_servicos`, `agenda`, `relatorios`, `fotos_relatorio`, `employee_bloqueios`

**No Supabase (só leitura):**
- `employees`, `estoque_saldos_totais`

**Híbrido:** lead aprovado permanece no localStorage mas ganha `clienteSupabaseId` ao ser promovido para o Supabase.

---

## Bugs conhecidos

- **Race condition — Escala:** `EscalaCampo.jsx:1038-1042` faz `Promise.all` de updates de `ordem_rota` sem transação. Drag & drop simultâneo de dois usuários pode gerar inconsistência.
- **Sem rollback:** `promoverParaCliente()` (`CRMContext.jsx:629-681`) pode deixar o cliente sem `cliente_servicos` se a segunda chamada falhar.
- **Anexos legado:** convivem `orcamentoAnexo` (singular) e `orcamentoAnexos` (array) em ModalOrcamento — dívida técnica pequena.
- **Export "CSV"** em `Configuracoes.jsx` gera JSON.
- **Sem RLS enforcement no cliente:** confiança total no Supabase.
- **Perda silenciosa ao editar:** clicar em outro lead antes de salvar o modal descarta mudanças sem aviso.

---

## Tech debt

| Arquivo | Linhas | Sinal |
|---|---|---|
| `EscalaCampo.jsx` | 2.406 | Crítico — precisa quebrar |
| `ModalOrcamento.jsx` | 1.342 | Crítico — precisa quebrar |
| `Dashboard.jsx` | 1.240 | Alto |
| `Clientes.jsx` | 820 | Aceitável |

- **Sem ESLint** configurado
- **Sem TypeScript**
- **Sem testes** (`vitest`/`jest` ausentes)
- Utilitários duplicados: `formatarData()`, `formatarValor()` em vários componentes (parcialmente centralizados em `src/utils/` após refactor `2714965`)

---

## Próximos passos priorizados

Ver [[PROXIMOS-PASSOS]] para o backlog geral. Do CRM especificamente:

1. **Migrar leads + tarefas para Supabase** (maior risco pendente)
2. **Corrigir race condition da Escala**
3. **Hardening de roles** (proteção de rotas)
4. **Estoque etapa 2** (CRUD de materiais e movimentos)
5. **Refatorar `EscalaCampo` e `ModalOrcamento`**
6. **Configurar ESLint + Vitest**

---

## Contexto técnico dos clientes

Todos os clientes da Verde Interior têm ambientes corporativos com:
- Ar condicionado ligado constantemente
- Apenas luz artificial (sem luz solar direta)
- Sem pontos de água próximos (rega manual com transporte de água)

Isso implica seleção de espécies resistentes a sombra e logística de rega planejada.

---

## Tipos de serviço (badges do Kanban)

| Serviço | Faturamento | Observação |
|---|---|---|
| Venda de Vasos e Plantas | Único | — |
| Manutenção de Vasos e Plantas | Recorrente | Mensal, Quinzenal ou Semanal |
| Reforma de Vasos e Plantas | Único por demanda | — |
| Locação de Vasos e Plantas | Recorrente | Manutenção inclusa |
| Locação de Vasos e Plantas para Eventos | Único | Data/hora estritas |
