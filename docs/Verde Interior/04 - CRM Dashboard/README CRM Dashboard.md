# CRM / Dashboard — Status Atual

**Status:** ✅ Deployado e operacional
**Stack:** React 18 + Vite (JavaScript puro)
**Pasta local:** `apps/crm/`
**Última atualização da doc:** 23/07/2026

---

## Módulos operacionais (10)

| Módulo | Estado | Persistência |
|---|---|---|
| Dashboard | ✅ Operacional (KPIs, range de datas, atalhos, follow-up limpo) | Supabase (agenda, clientes, relatórios) |
| **Pipeline / Kanban** | ✅ Funil de vendas com 5 estágios, **multi-tipo de serviço** (016), delete lead na UI | ✅ Supabase (`leads`, migration 015) |
| **Tarefas** | ✅ CRUD com prioridade, categoria, vínculo com lead | ✅ Supabase (`tarefas`, migration 015) |
| Funil de Execução | ✅ Kanban pós-aprovação (materiais → pós-venda) | Supabase (estoque, employees) + leads via context |
| Clientes | ✅ CRUD com dias disponíveis, janelas, frequência, completude; 120 clientes importados | Supabase (`clientes`, `cliente_servicos`) |
| **Ordens de Serviço** | ✅ Lista com `os_id` real (OS-NNN), criado automaticamente ao aprovar orçamento | Supabase (`ordens_servico`) |
| Escala de Campo | ✅ Otimizador corrigido (usa `janela_entrada_inicio`), drag & drop atômico via RPC, bloqueios, **aceita visitas de lead** (016); canceladas ocultas no App Ponto | Supabase (`agenda`, `employees`, `employee_bloqueios`, `leads`) |
| Relatórios | ✅ Fase 4 (fotos, assinatura, GPS, reverse geocoding) | Supabase (`relatorios`, `fotos_relatorio`, storage) |
| Agenda | ✅ Calendário + sidebar | Supabase (`agenda`) |
| **Estoque v2** | ✅ 5 abas: Plantas, Insumos, Vasos, Materiais, QR Codes. 260 patrimônios. Scan mobile. | Supabase (`estoque_*` — ver schema) |

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

## Estoque v2 — 5 abas

| Aba | O que mostra | Fonte de dados |
|---|---|---|
| **Plantas** | Espécies do catálogo + quantidades (disponíveis, no cliente, manutenção) | `estoque_especies_resumo` (view) |
| **Insumos** | Itens da categoria `insumo` com saldo e movimentações | `estoque_itens_saldo_total` (view) |
| **Vasos** | Itens da categoria `vaso` | `estoque_itens_saldo_total` |
| **Materiais** | Itens da categoria `material` | `estoque_itens_saldo_total` |
| **QR Codes** | Patrimônios físicos VI-xxxx, gera QR, atribui espécie, imprime etiqueta | `estoque_patrimonios_view` |

**Scan mobile:** URL `?patrimonio=VI-xxxx` detectada em `App.jsx` ao carregar → abre `ModalAtribuirQR` como overlay em qualquer dispositivo sem precisar de rota separada.

---

## Autenticação (já implementada)

- `AuthContext.jsx` → `supabase.auth.signInWithPassword()` (email `{user}@vi.app`)
- Session: `user.id`, `user.email`, `user_metadata.username`, `user_metadata.role` (default `colab`)
- `AppGate` renderiza `<Login />` se não houver sessão
- Policies anônimas removidas em 07/2026

**Pendente:** proteção granular de rotas por role (hoje qualquer usuário autenticado acessa todas as views).

---

## Persistência — mapa real

**Cache local (não é fonte de verdade):**
- `crm-verde-leads` e `crm-verde-tarefas` — cache de rendering rápido + fallback offline
- `crm-font-scale`, `crm-notif-*`, `crm-metas` (preferências, não sincronizam)

**No Supabase (leitura + escrita):**
- `leads`, `tarefas` (015), `clientes`, `cliente_servicos`, `agenda` (com `lead_id`, 016), `relatorios`, `fotos_relatorio`, `employee_bloqueios`, `ordens_servico` (019)
- `estoque_especies`, `estoque_patrimonios`, `estoque_eventos`, `estoque_manutencoes`, `estoque_itens`, `estoque_itens_movs` (025-028)

**No Supabase (só leitura no CRM):**
- `employees`, `estoque_patrimonios_view`, `estoque_especies_resumo`, `estoque_itens_saldo_total`, `estoque_itens_saldo_titular`, `audit_log` (só gestor)

**Deprecated (mantidas no banco por compat):**
- `materiais`, `estoque_movimentacoes` — dados migrados para as novas tabelas em 027

---

## Bugs conhecidos (resolvidos ou pendentes)

- ✅ **Race condition — Escala** (RESOLVIDO em 015): RPC atômica `reorder_agenda(p_updates jsonb)`.
- ✅ **Otimizador de rota** (RESOLVIDO em commit 180201a): usa `janela_entrada_inicio` em vez de `hora_estimada_chegada` salva.
- ✅ **Visitas canceladas** (RESOLVIDO em commit 7ebb341): ocultas do App Ponto.
- **Sem rollback:** `promoverParaCliente()` pode deixar cliente sem `cliente_servicos` se segunda chamada falhar.
- **Anexos legado:** convivem `orcamentoAnexo` (singular) e `orcamentoAnexos` (array) — dívida técnica.
- **Export "CSV"** em `Configuracoes.jsx` gera JSON com extensão `.csv`.
- **Sem RLS enforcement no cliente:** confiança total no Supabase (`_auth_all` no CRM).

---

## Tech debt

| Arquivo | Linhas | Sinal |
|---|---|---|
| `ModalOrcamento.jsx` | ~1.700 | Crítico — SecaoAnexos, SecaoAgendaLead, SecaoFluxo, SecaoLead pendentes |
| `EscalaCampo.jsx` | ~879 | Refatorado 64% (de 2.456) — ainda extenso; falta EscalaGrid, EscalaCartao, EscalaOtimizador |
| `Dashboard.jsx` | ~1.300 | Alto |
| `Clientes.jsx` | 820 | Aceitável |

- ✅ **ESLint configurado** (`eslint.config.js`, flat config com react + hooks). Baseline: 15 warnings (exhaustive-deps, unused vars).
- ✅ **Vitest configurado** com 24 testes: 13 em `CRMContext.test.js`, 11 em `otimizadorRota.test.js`.
- **Sem TypeScript**

---

## Próximos passos priorizados

Ver [[PROXIMOS-PASSOS]] para o backlog geral. Do CRM especificamente:

1. **Reset de senha** — Edge Function pronta (`admin-reset-password`), falta: SMTP no Supabase Dashboard → Auth → Custom SMTP + `supabase functions deploy` + popular `profiles.email_recuperacao`
2. **Estoque — completar fluxo QR:** botão "Registrar evento" (instalação, retirada, manutenção) na aba QR Codes
3. **Refatorar `ModalOrcamento.jsx`** — SecaoAnexos, SecaoAgendaLead, SecaoFluxo, SecaoLead (estado compartilhado profundo)
4. **Refatorar `EscalaCampo.jsx`** — EscalaGrid, EscalaCartao, EscalaOtimizador
5. **Corrigir 15 warnings ESLint**

---

## Contexto técnico dos clientes

Todos os clientes da Verde Interior têm ambientes corporativos com:
- Ar condicionado ligado constantemente
- Apenas luz artificial (sem luz solar direta)
- Sem pontos de água próximos (rega manual com transporte de água)

---

## Tipos de serviço (badges do Kanban)

Desde a migration 016, um lead pode ter **múltiplos** tipos simultâneos. Coluna `leads.tipos_servico TEXT[]`.

| Serviço | Faturamento | Observação |
|---|---|---|
| Venda de Vasos e Plantas | Único | — |
| Manutenção de Vasos e Plantas | Recorrente | Mensal, Quinzenal ou Semanal |
| Reforma de Vasos e Plantas | Único por demanda | — |
| Locação de Vasos e Plantas | Recorrente | Manutenção inclusa |
| Locação de Vasos e Plantas para Eventos | Único | Data/hora estritas |

---

## Integrações novas (20/07/2026)

- **Gerar orçamento a partir do lead** — botão "🛠 Gerar orçamento" no `ModalOrcamento` abre `/gerador-orcamento.html?empresa=...&contato=...&servico=...` em nova aba.
- **Agendar visita técnica direto do lead** — seção "📅 Agendar visita técnica na Escala" no `ModalOrcamento`.

## Estoque v2 (23/07/2026)

- 260 patrimônios VI-0001→VI-0260 pré-gerados com QR codes únicos
- 37 espécies cadastradas no catálogo inicial
- Scan mobile: escanear QR → URL com `?patrimonio=VI-xxxx` → `ModalAtribuirQR` abre automaticamente → seleciona espécie → registra evento `troca_especie`
- Migrations 025-028 aplicadas via Supabase CLI
