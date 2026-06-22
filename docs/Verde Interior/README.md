# Verde Interior — Central do Projeto

Documentação de todos os módulos e decisões do sistema interno da Verde Interior Paisagismo.

Atualizado ao final de cada sessão de desenvolvimento com Claude.

---

## Módulos

| Módulo | Status | Pasta local | Documentação |
|---|---|---|---|
| Ponto Eletrônico | ✅ Produção | `apps/ponto/` | [[02 - Ponto Eletrônico/README]] |
| Gerador de Orçamentos | 🟡 Melhorias pendentes | `tools/orcamentos/` | [[01 - Orçamentos/README]] |
| Ordem de Serviço | 🟡 Adaptação mobile | `tools/ordem-de-servico/` | [[03 - Ordem de Serviço/README]] |
| CRM / Dashboard | 🔴 Em desenvolvimento | `apps/crm/` | [[04 - CRM Dashboard/README]] |
| Plataforma Unificada | ⬜ Planejado | — | [[05 - Plataforma Unificada/README]] |

---

## Decisões abertas (urgentes)

- [x] ~~Sistema de fotos da OS~~ → Opção B escolhida — [[03 - Ordem de Serviço/decisoes-pendentes]]
- [x] ~~Formato do ID único de cliente~~ → `CLI-NNN`, `ORC-NNN`, `OS-NNN` — [[06 - Padrões Comuns/padroes-comuns]]
- [x] ~~Status do orçamento como gatilho de OS~~ → `orcamento_aprovado` dispara criação da OS — [[06 - Padrões Comuns/padroes-comuns]]

---

## Referências

- [[PROXIMOS-PASSOS]] — checklist da equipe, sprint atual, convenção de branches
- [[00 - Visão Geral/arquitetura-geral]] — stack, decisões estruturais, banco de dados
- [[00 - Visão Geral/decisoes-importantes]] — log cronológico de decisões
- [[06 - Padrões Comuns/padroes-comuns]] — cores, tipografia, componentes, regras de negócio
