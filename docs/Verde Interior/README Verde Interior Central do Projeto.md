# Verde Interior — Central do Projeto

Documentação de todos os módulos e decisões do sistema interno da Verde Interior Paisagismo.

Atualizado ao final de cada sessão de desenvolvimento com Claude.
Última atualização: 20/07/2026.

---

## Módulos

| Módulo | Status | Pasta local | Documentação |
|---|---|---|---|
| Ponto Eletrônico | ✅ Produção + XLSX + audit_log + frequência + gráfico banco horas | `apps/ponto/` | [[README Ponto Eletrônico]] |
| CRM / Dashboard | ✅ Deployado, multi-tipo de serviço, agenda-a-partir-de-lead, Estoque etapa 2 | `apps/crm/` | [[README CRM Dashboard]] |
| Gerador de Orçamentos | ✅ 3 bugs corrigidos + 6 features + integração via query string com CRM | `tools/orcamentos/` + `apps/crm/public/gerador-orcamento.html` | [[README Gerador de Orçamentos]] |
| Ordem de Serviço (HTML) | ✅ Modo Execução/Conclusão dinâmico + parametrizado por OS + QR | `tools/ordem de servico/` + `apps/crm/public/os.html` | [[README Ordem de Serviço]] |
| Plataforma Unificada | ⬜ Planejado (aguardando refactors de EscalaCampo e ModalOrcamento) | — | [[README Plataforma Unificada]] |

---

## Módulos do CRM em detalhe

O CRM cresceu bastante: hoje agrupa 9 módulos operacionais. Ver [[04 - CRM Dashboard/README CRM Dashboard]] para o mapa completo. Destaques:

- **Escala de Campo** — otimizador de rota + drag & drop atômico via RPC + tooltips + bloqueios; agora aceita visitas com `lead_id` (badge "🌱 lead")
- **Relatórios de campo** — fotos + assinatura + GPS + reverse geocoding (Fase 4)
- **Clientes** — CRUD com dias/janelas/completude, integrado ao Supabase
- **Estoque** — Etapa 2 completa: cadastro de material + movimentação (entrada/saída/ajuste/perda/transferência)
- **Pipeline** — leads e tarefas no Supabase (migration 015), tipos de serviço em array (migration 016), delete via UI, follow-up limpo (só ações reais + "🕐 só lembrete")

---

## Decisões já tomadas

- ✅ Sistema de fotos da OS → Opção B (Modo Execução/Conclusão) — implementada 20/07/2026 — [[03 - Ordem de Serviço/decisoes-pendentes]]
- ✅ Formato do ID único de cliente → `CLI-NNN`, `ORC-NNN`, `OS-NNN` — [[06 - Padrões Comuns/padroes-comuns]]
- ✅ Status do orçamento como gatilho de OS → `orcamento_aprovado` dispara criação da OS — [[06 - Padrões Comuns/padroes-comuns]]
- ✅ Estratégia modular primeiro, unificar depois — [[00 - Visão Geral/decisoes-importantes]]
- ✅ Leads + tarefas no Supabase (015), multi-tipo de serviço + agenda-a-partir-de-lead (016), audit_log genérico (017) — [[00 - Visão Geral/decisoes-importantes]]

---

## Referências

- [[PROXIMOS-PASSOS]] — checklist da equipe, sprint atual
- [[00 - Visão Geral/arquitetura-geral]] — stack, decisões estruturais, banco de dados
- [[00 - Visão Geral/decisoes-importantes]] — log cronológico de decisões
- [[06 - Padrões Comuns/padroes-comuns]] — cores, tipografia, componentes, regras de negócio
