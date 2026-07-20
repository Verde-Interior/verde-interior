# Verde Interior — Próximos Passos

> Documento de trabalho da equipe. Marcar conforme concluir.
> Última atualização: 20/07/2026 (Fase 1 fechada)

---

## Estado geral (resumo em 1 minuto)

| Módulo | Status | O que sobra |
|---|---|---|
| **Ponto Eletrônico** | ✅ Produção, maduro | Reset de senha, XLSX, relatórios avançados, auditoria |
| **CRM** | ✅ Deployado, 9 módulos ativos + multi-tipo + agenda-a-partir-de-lead | Estoque etapa 2, refactors |
| **Escala de Campo (CRM)** | ✅ Aceita visitas de leads (não só clientes) | Refactor 2.400 linhas |
| **Relatórios de campo (CRM)** | ✅ Fase 4 completa | — |
| **Gerador de Orçamentos** | 🟡 Bugs corrigidos, integrado ao CRM | 6 features essenciais |
| **Ordem de Serviço (HTML)** | 🟡 Congelado desde 22/jun | Modo Execução/Conclusão dinâmico, integração com backend |

---

## ✅ Concluído em 20/07/2026 (sprint 1+2)

### CRM — Migrar leads e tarefas para Supabase
- [x] Tabelas `leads` e `tarefas` criadas (migration `015_crm_leads_tarefas.sql`)
- [x] RLS `_auth_all` (roles adiados — só gestores usam CRM)
- [x] `CRMContext.jsx` fala com Supabase (bootstrap + optimistic writes), localStorage vira cache offline
- [x] Reset em vez de backfill (sem dados de produção a preservar)
- [x] Schema documentado em [[00 - Visão Geral/schema-supabase]]

### Gerador de Orçamentos — 3 bugs críticos
- [x] Bug 1: validação de itens vazios + modelo ativo em `gerarProposta()`
- [x] Bug 2: reset automático do título quando vazio ou igual ao gerado; `title` de descoberta pro dblclick
- [x] Bug 3: `syncCamposCondicionais` reseta toggle e rádios ao entrar em Locação

### CRM — Race condition da Escala
- [x] RPC atômica `reorder_agenda(p_updates jsonb)` na migration 015
- [x] `moverSelecionadasPara`, `moverVisita`, `aplicarOrdemRota`, `aplicar` (redistribuição) todos passam pela RPC

---

## ✅ Concluído em 20/07/2026 (Fase 1 — quick wins)

### 5 observações do dia-a-dia do Roberto
- [x] **Deletar lead**: função `removerLead` já existia mas sem UI. Adicionado botão 🗑 no `LeadCard` (aparece no hover, canto superior esquerdo) e botão "🗑 Excluir" no header do `ModalOrcamento`. Ambos com confirmação nativa.
- [x] **Botão "Gerar orçamento" ao lado do "Anexar"**: gerador HTML copiado para `apps/crm/public/gerador-orcamento.html`. `ModalOrcamento` tem botão "🛠 Gerar orçamento" que abre o gerador em nova aba com dados do lead pré-preenchidos via query string. HTML atualizado para ler `?empresa=&contato=&bairro=&servico=...` no load.
- [x] **Multi-tipo de serviço**: `leads.tipo_servico TEXT` → `leads.tipos_servico TEXT[]` (migration 016). Helpers `getTiposServico()` / `getTipoPrimario()` no CRMContext. AddLeadModal, ModalOrcamento (edit form), LeadCard, KanbanBoard, FunilExecucao, Dashboard, GlobalSearch e `promoverParaCliente` adaptados. Combinações como "reforma+manutenção" e "locação+manutenção" agora funcionam.
- [x] **Agendar visita técnica direto do lead**: `agenda.cliente_id` agora nullable + `agenda.lead_id UUID FK leads` + CHECK exclusivo (migration 016). Nova seção "📅 Agendar visita técnica na Escala" no ModalOrcamento: select de funcionário + data + hora + duração + observações + botão "Publicar na Escala". EscalaCampo carrega visitas com `lead_id` (join também com `leads`) e mostra badge "🌱 lead" no cartão. Não precisa mais promover para cliente antes de agendar visita técnica.
- [x] **Follow-up sem poluição**: 9 assuntos genéricos reduzidos para 4 ações essenciais (Enviar orçamento, Confirmar aprovação, Agendar visita, Retornar contato) + 1 marcador "🕐 Só lembrete". Separação visual no Dashboard: itens com ação pendente ganham borda verde (forest-500), itens só-lembrete ficam com borda cinza discreta + opacidade reduzida + tag "🕐 Lembrete". Assuntos legados mantidos silenciosamente no dicionário pra não quebrar leads antigos.

### Passos manuais para fechar Fase 1

- [ ] **Aplicar migration 016 no Supabase:** dashboard → SQL Editor → colar `apps/ponto/supabase/migrations/016_lead_multi_servico_e_agenda_lead.sql` → rodar. Sem isso, multi-tipo e agenda-para-lead não persistem.
- [ ] Reload no CRM e testar: criar lead com 2 tipos, agendar visita direto do lead, ver o cartão na Escala com badge "🌱 lead".

---

## Agora — Alta prioridade

### CRM — Estoque etapa 2 e 3
Etapa 1 está publicada: lista + KPIs read-only. Botões "+ Material" e "+ Movimento" estão **desabilitados** (`Estoque.jsx:104-109`).

- [ ] Etapa 2: modais de cadastro de material e registro de movimento
- [ ] Etapa 3: histórico de movimentações + integração automática com `FunilExecucao` (saída ao consumir material em obra)

### OS (HTML) — Modo Execução/Conclusão dinâmico
Hoje o sistema de fotos existe mas é hardcoded para o cliente Heimr. Precisa parametrizar por OS e implementar o gating de "Depois só libera após Antes" (Opção B decidida em 22/jun).

- [ ] Parametrizar dados de cliente/plantas por OS (remover hardcode Heimr)
- [ ] Implementar modo Execução (só "Antes") vs Conclusão (libera "Depois")
- [ ] Gerar link/QR fixo por OS para acesso do colaborador em campo

### Gerador de Orçamentos — 6 funcionalidades essenciais (Roberto)

- [ ] Numeração automática de propostas (`ORC-NNN` sequencial)
- [ ] Salvamento de rascunho em `localStorage`
- [ ] Data de validade automática (+30 dias)
- [ ] Campos de e-mail e telefone do cliente
- [ ] Desconto global
- [ ] Botão "limpar tudo"

---

## Depois

### Ponto Eletrônico — Fechar as pontas
Módulo maduro, últimas features documentadas mas não priorizadas.

- [ ] Reset de senha via e-mail (UI faltando)
- [ ] Gestor redefine senha de colaborador
- [ ] Exportação XLSX (hoje só CSV) — usar SheetJS
- [ ] Relatório de frequência mensal (faltas / atrasos)
- [ ] Gráfico de evolução do banco de horas
- [ ] Auditoria: log de edições do gestor (`audit_log` em `punch_records` e `justifications`)
- [ ] View de Perfil do colaborador (placeholder existe, sem implementação)
- [ ] Escapar campos de texto livre (XSS potencial em observações)

### CRM — Tech debt
Componentes gigantes começam a atrapalhar manutenção.

- [ ] Refatorar `ModalOrcamento.jsx` (1.342 linhas) em: `SecaoLead`, `SecaoAnexos`, `SecaoServicos`, `SecaoContrato`, `SecaoHistorico`
- [ ] Refatorar `EscalaCampo.jsx` (2.406 linhas) em subcomponentes (grid semanal, cartão, otimizador, modal edição)
- [ ] Configurar ESLint no CRM (Ponto já tem)
- [ ] Introduzir Vitest com testes dos reducers do `CRMContext` e do otimizador de rota

### CRM — Melhorias de UX pendentes

- [ ] Exportação real em CSV (hoje `exportarDados()` gera JSON com nome "CSV")
- [ ] Deletar campo legado `orcamentoAnexo` singular (coexiste com `orcamentoAnexos` array)
- [ ] Modal de novo cliente (verificar se está funcional; validação de completude)
- [ ] `FunilExecucao`: UI de cadastro/edição de materiais (hoje só mostra faltantes)

---

## Futuro — Plataforma Unificada

Só iniciar quando o CRM tiver leads+tarefas em Supabase e o hardening de roles estiver pronto.

- [ ] IDs únicos `CLI-NNN` / `ORC-NNN` / `OS-NNN` propagados em todos os módulos
- [ ] Trigger: orçamento aprovado no CRM → cria OS automaticamente
- [ ] Migrar Gerador de Orçamentos (HTML) para módulo React dentro do CRM
- [ ] Migrar OS (HTML) para módulo React dentro do CRM
- [ ] OS vinculada ao ponto do colaborador responsável
- [ ] Dashboard financeiro com margem real por tipo de serviço
- [ ] Banco de mídias (galeria Antes/Depois para marketing)
- [ ] Portal do cliente (visualizar OS, aprovar serviços)

Ver: [[05 - Plataforma Unificada/README Plataforma Unificada]]

---

## Setup do ambiente

**CRM**
```
cd apps/crm
npm install
npm run dev     ← http://localhost:5173
```

**Ponto Eletrônico**
```
cd apps/ponto
npm install
npm run dev
```

**OS e Orçamentos** — abrir o `.html` diretamente no navegador, sem instalação.

---

## Regras que não mudar sem discussão

- Credenciais Supabase — rotacionar só com todos cientes e atualizar Vercel junto
- Nomes dos funcionários — são chaves no banco do Ponto
- Fluxo de ponto: `entry → break → return → exit`
- Paleta de cores — deriva do logo da empresa
- Lógica de `calcWork` / `calcWorkClosed` no Ponto

Decisões novas → registrar em [[00 - Visão Geral/decisoes-importantes]]
Design system → atualizar [[06 - Padrões Comuns/padroes-comuns]]
