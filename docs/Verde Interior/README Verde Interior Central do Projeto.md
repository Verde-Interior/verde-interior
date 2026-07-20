# Verde Interior — Central do Projeto

Documentação de todos os módulos e decisões do sistema interno da Verde Interior Paisagismo.

Atualizado ao final de cada sessão de desenvolvimento com Claude.
Última atualização: 20/07/2026.

---

## Módulos

| Módulo | Status | Pasta local | Documentação |
|---|---|---|---|
| Ponto Eletrônico | ✅ Produção | `apps/ponto/` | [[README Ponto Eletrônico]] |
| CRM / Dashboard | ✅ Deployado, 9 módulos ativos | `apps/crm/` | [[README CRM Dashboard]] |
| Gerador de Orçamentos | 🟡 3 bugs + 6 features pendentes | `tools/orcamentos/` | [[README Gerador de Orçamentos]] |
| Ordem de Serviço (HTML) | 🟡 Congelado — modo Execução/Conclusão pendente | `tools/ordem-de-servico/` | [[README Ordem de Serviço]] |
| Plataforma Unificada | ⬜ Planejado (aguardando CRM estabilizar) | — | [[README Plataforma Unificada]] |

---

## Módulos do CRM em detalhe

O CRM cresceu bastante: hoje agrupa 9 módulos operacionais. Ver [[04 - CRM Dashboard/README CRM Dashboard]] para o mapa completo. Destaques:

- **Escala de Campo** — otimizador de rota + drag & drop + tooltips + bloqueios (Fase 5.2 nível 2)
- **Relatórios de campo** — fotos + assinatura + GPS + reverse geocoding (Fase 4)
- **Clientes** — CRUD com dias/janelas/completude, integrado ao Supabase
- **Estoque** — Etapa 1 (read-only); CRUD na Etapa 2

---

## Risco pendente mais alto

**Leads e tarefas do CRM ainda vivem em `localStorage`.** Auth, Clientes, Escala, Relatórios e Estoque já estão no Supabase — mas o core comercial (pipeline de leads e to-do) não. Se qualquer usuário limpar cache ou trocar dispositivo, perde tudo. Ver [[PROXIMOS-PASSOS]] → "CRM — Migrar leads e tarefas para Supabase".

---

## Decisões já tomadas

- ✅ Sistema de fotos da OS → Opção B (Modo Execução/Conclusão) — [[03 - Ordem de Serviço/decisoes-pendentes]]
- ✅ Formato do ID único de cliente → `CLI-NNN`, `ORC-NNN`, `OS-NNN` — [[06 - Padrões Comuns/padroes-comuns]]
- ✅ Status do orçamento como gatilho de OS → `orcamento_aprovado` dispara criação da OS — [[06 - Padrões Comuns/padroes-comuns]]
- ✅ Estratégia modular primeiro, unificar depois — [[00 - Visão Geral/decisoes-importantes]]

---

## Referências

- [[PROXIMOS-PASSOS]] — checklist da equipe, sprint atual
- [[00 - Visão Geral/arquitetura-geral]] — stack, decisões estruturais, banco de dados
- [[00 - Visão Geral/decisoes-importantes]] — log cronológico de decisões
- [[06 - Padrões Comuns/padroes-comuns]] — cores, tipografia, componentes, regras de negócio
