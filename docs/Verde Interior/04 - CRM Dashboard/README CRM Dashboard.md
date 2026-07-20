# CRM / Dashboard — Status Atual

**Status:** ✅ Deployado e operacional
**Stack:** React 18 + Vite (JavaScript puro)
**Pasta local:** `apps/crm/`
**Última atualização da doc:** 20/07/2026

---

## Módulos operacionais (9)

| Módulo | Estado | Persistência |
|---|---|---|
| Dashboard | ✅ Operacional (KPIs, range de datas, atalhos, follow-up limpo separando ação vs lembrete) | Supabase (agenda, clientes, relatórios) |
| **Pipeline / Kanban** | ✅ Funil de vendas com 5 estágios, **multi-tipo de serviço** (016), delete lead na UI | ✅ Supabase (`leads`, migration 015) |
| **Tarefas** | ✅ CRUD com prioridade, categoria, vínculo com lead | ✅ Supabase (`tarefas`, migration 015) |
| Funil de Execução | ✅ Kanban pós-aprovação (materiais → pós-venda) | Supabase (estoque, employees) + leads via context |
| Clientes | ✅ CRUD com dias disponíveis, janelas, frequência, completude | Supabase (`clientes`, `cliente_servicos`) |
| Escala de Campo | ✅ Otimizador, drag & drop atômico via RPC `reorder_agenda`, tooltips, bloqueios, **aceita visitas de lead** (badge "🌱 lead", 016) | Supabase (`agenda`, `employees`, `employee_bloqueios`, `leads`) |
| Relatórios | ✅ Fase 4 (fotos, assinatura, GPS, reverse geocoding) | Supabase (`relatorios`, `fotos_relatorio`, storage) |
| Agenda | ✅ Calendário + sidebar | Supabase (`agenda`) |
| Estoque | ✅ Etapa 2: lista + KPIs + **modais de cadastro de material e movimentação** | Supabase (`materiais`, `estoque_movimentacoes`, `estoque_saldos_totais`) |

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

**Cache local (não é fonte de verdade):**
- `crm-verde-leads` e `crm-verde-tarefas` — cache de rendering rápido + fallback offline (fonte de verdade é o Supabase)
- `crm-font-scale`, `crm-nome-usuario`, `crm-notif-*`, `crm-metas` (preferências, não sincronizam)

**No Supabase (leitura + escrita):**
- `leads`, `tarefas` (015), `clientes`, `cliente_servicos`, `agenda` (agora com `lead_id`, 016), `relatorios`, `fotos_relatorio`, `employee_bloqueios`, `materiais`, `estoque_movimentacoes`

**No Supabase (só leitura no CRM):**
- `employees`, `estoque_saldos_totais` (view), `audit_log` (só gestor lê)

**Multi-tipo de serviço (016):** `leads.tipos_servico TEXT[]` substitui `tipo_servico` (singular). Acesso via helper `getTiposServico(lead)` no CRMContext — aceita array novo, string legada ou vazio.

---

## Bugs conhecidos (resolvidos ou pendentes)

- ✅ **Race condition — Escala** (RESOLVIDO em 015): RPC atômica `reorder_agenda(p_updates jsonb)` substitui todos os `Promise.all` de updates. Drag & drop e otimizador agora são transacionais.
- **Sem rollback:** `promoverParaCliente()` (`CRMContext.jsx`) pode deixar o cliente sem `cliente_servicos` se a segunda chamada falhar. Agora cria N contratos (um por tipo recorrente/venda) — mais chances de partial failure.
- **Anexos legado:** convivem `orcamentoAnexo` (singular) e `orcamentoAnexos` (array) em ModalOrcamento — dívida técnica pequena.
- **Export "CSV"** em `Configuracoes.jsx` gera JSON.
- **Sem RLS enforcement no cliente:** confiança total no Supabase (padrão `_auth_all` no CRM — só authenticated, sem role granular).
- **Perda silenciosa ao editar:** clicar em outro lead antes de salvar o modal descarta mudanças sem aviso.

---

## Tech debt

| Arquivo | Linhas | Sinal |
|---|---|---|
| `EscalaCampo.jsx` | ~2.500 | Crítico — precisa quebrar em subcomponentes |
| `ModalOrcamento.jsx` | ~1.700 | Crítico — precisa quebrar em seções |
| `Dashboard.jsx` | ~1.300 | Alto |
| `Clientes.jsx` | 820 | Aceitável |

- ✅ **ESLint configurado** (`eslint.config.js`, flat config com react + hooks + prettier). Rodar `npm run lint`. Baseline: 1 erro + 15 warnings.
- ✅ **Vitest configurado** com 13 testes de helpers do CRMContext (`getTiposServico`, `addDias`, `criarFluxoOrcamento`). Rodar `npm test`.
- **Sem TypeScript**
- Utilitários duplicados: `formatarData()`, `formatarValor()` em vários componentes (parcialmente centralizados em `src/utils/` após refactor `2714965`)

---

## Próximos passos priorizados

Ver [[PROXIMOS-PASSOS]] para o backlog geral. Do CRM especificamente:

1. **Refatorar `EscalaCampo.jsx`** em: `EscalaGrid`, `EscalaCartao`, `EscalaOtimizador`, `EscalaModalEdicao`, `EscalaRedistribuicao`, `EscalaMapa`. Uma extração por vez, build passando entre cada.
2. **Refatorar `ModalOrcamento.jsx`** em: `SecaoLead`, `SecaoAnexos`, `SecaoServicos`, `SecaoContrato`, `SecaoAgendaLead`, `SecaoFluxo`, `SecaoHistorico`.
3. **Corrigir os 15 warnings do ESLint** (unused vars e exhaustive-deps intencionais).
4. **Ampliar cobertura de testes** — otimizador de rota da Escala e `promoverParaCliente` (mocking do supabase-js).
5. **Hardening de roles** (só quando colaborador de campo precisar entrar no CRM).

---

## Contexto técnico dos clientes

Todos os clientes da Verde Interior têm ambientes corporativos com:
- Ar condicionado ligado constantemente
- Apenas luz artificial (sem luz solar direta)
- Sem pontos de água próximos (rega manual com transporte de água)

Isso implica seleção de espécies resistentes a sombra e logística de rega planejada.

---

## Tipos de serviço (badges do Kanban)

Desde a migration 016, um lead pode ter **múltiplos** tipos simultâneos (ex: "reforma + manutenção" para reformar as plantas existentes e depois manter contrato; "locação + manutenção" para não perder plantas rápido). Coluna `leads.tipos_servico TEXT[]`.

| Serviço | Faturamento | Observação |
|---|---|---|
| Venda de Vasos e Plantas | Único | — |
| Manutenção de Vasos e Plantas | Recorrente | Mensal, Quinzenal ou Semanal |
| Reforma de Vasos e Plantas | Único por demanda | — |
| Locação de Vasos e Plantas | Recorrente | Manutenção inclusa |
| Locação de Vasos e Plantas para Eventos | Único | Data/hora estritas |

---

## Integrações novas (20/07/2026)

- **Gerar orçamento a partir do lead** — botão "🛠 Gerar orçamento" no `ModalOrcamento` abre `/gerador-orcamento.html?empresa=...&contato=...&servico=...` em nova aba (dados do lead pré-preenchidos).
- **Agendar visita técnica direto do lead** — seção "📅 Agendar visita técnica na Escala" no `ModalOrcamento`: gestor escolhe funcionário + data + hora + duração + observações, publica direto na Escala (sem precisar cadastrar cliente primeiro). Aparece na Escala com badge "🌱 lead".
