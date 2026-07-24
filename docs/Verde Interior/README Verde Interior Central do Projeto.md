# Verde Interior — Central do Projeto

Documentação de todos os módulos e decisões do sistema interno da Verde Interior Paisagismo.

Atualizado ao final de cada sessão de desenvolvimento com Claude.
Última atualização: 23/07/2026.

---

## Módulos

| Módulo | Status | Pasta local | Documentação |
|---|---|---|---|
| Ponto Eletrônico | ✅ Produção + XLSX + audit_log + frequência + gráfico banco horas | `apps/ponto/` | [[README Ponto Eletrônico]] |
| CRM / Dashboard | ✅ Deployado, 10 módulos + Estoque v2 (5 abas + QR Codes) | `apps/crm/` | [[README CRM Dashboard]] |
| Gerador de Orçamentos | ✅ 3 bugs corrigidos + 6 features + integração via query string com CRM | `tools/orcamentos/` + `apps/crm/public/gerador-orcamento.html` | [[README Gerador de Orçamentos]] |
| Ordem de Serviço (HTML) | ✅ Modo Execução/Conclusão dinâmico + parametrizado por OS + QR | `tools/ordem de servico/` + `apps/crm/public/os.html` | [[README Ordem de Serviço]] |
| Plataforma Unificada | ⬜ Planejado (aguardando refactors de EscalaCampo e ModalOrcamento) | — | [[README Plataforma Unificada]] |

---

## Módulos do CRM em detalhe

O CRM cresceu bastante: hoje agrupa 10 módulos operacionais. Ver [[04 - CRM Dashboard/README CRM Dashboard]] para o mapa completo. Destaques:

- **Escala de Campo** — otimizador de rota + drag & drop atômico via RPC + tooltips + bloqueios; aceita visitas com `lead_id` (badge "🌱 lead"); visitas canceladas ocultas no App Ponto
- **Relatórios de campo** — fotos + assinatura + GPS + reverse geocoding
- **Clientes** — CRUD com dias/janelas/completude; 120 clientes importados (migration 023); merge de duplicados (migration 024)
- **Ordens de Serviço** — lista com `os_id` real (OS-NNN), criado automaticamente ao aprovar orçamento
- **Estoque v2** — 5 abas: Plantas (espécies + quantidades), Insumos, Vasos, Materiais, QR Codes. 260 patrimônios individuais VI-0001→VI-0260. Scan mobile via `?patrimonio=VI-xxxx`
- **Pipeline** — leads e tarefas no Supabase (015), tipos de serviço em array (016), delete via UI

---

## Migrações aplicadas

28 migrations aplicadas via Supabase CLI (`supabase db push`). Referência completa em [[00 - Visão Geral/schema-supabase]].

---

## Decisões já tomadas

- ✅ Sistema de fotos da OS → Opção B (Modo Execução/Conclusão) — implementada 20/07/2026 — [[03 - Ordem de Serviço/decisoes-pendentes]]
- ✅ Formato do ID único de cliente → `CLI-NNN`, `ORC-NNN`, `OS-NNN` — [[06 - Padrões Comuns/padroes-comuns]]
- ✅ Status do orçamento como gatilho de OS → `orcamento_aprovado` dispara criação da OS — [[06 - Padrões Comuns/padroes-comuns]]
- ✅ Estratégia modular primeiro, unificar depois — [[00 - Visão Geral/decisoes-importantes]]
- ✅ Leads + tarefas no Supabase (015), multi-tipo de serviço + agenda-a-partir-de-lead (016), audit_log genérico (017) — [[00 - Visão Geral/decisoes-importantes]]
- ✅ QR patrimônios (VI-xxxx) como identidade física permanente da planta — `qr_codigo` é imutável após geração; espécie atribuída ao QR pode mudar a qualquer momento — [[00 - Visão Geral/decisoes-importantes]]
- ✅ Supabase CLI (`supabase db push`) como único canal para aplicar migrations — nunca mais pelo SQL Editor manual — [[00 - Visão Geral/decisoes-importantes]]

---

## Referências

- [[PROXIMOS-PASSOS]] — checklist da equipe, sprint atual
- [[00 - Visão Geral/arquitetura-geral]] — stack, decisões estruturais, banco de dados
- [[00 - Visão Geral/decisoes-importantes]] — log cronológico de decisões
- [[06 - Padrões Comuns/padroes-comuns]] — cores, tipografia, componentes, regras de negócio
