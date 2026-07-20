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

## ✅ Concluído em 20/07/2026 (Fases 2 + 3 — Sprints 3 e 4)

### Sprint 3-A — CRM Estoque etapa 2
- [x] `ModalMaterial.jsx`/`.css`: cadastro/edição de material (nome, categoria, unidade, SKU, descrição, foto_url, estoque_minimo, controla_posse, ativo). ESC/overlay fecha.
- [x] `ModalMovimento.jsx`/`.css`: entrada/saída/ajuste/perda/transferência com radio-pill colorido. Select de material com busca (só ativos). Titular via employees. Transferência exige `titular_destino_id` distinto.
- [x] Botões "+ Material" e "+ Movimento" no header desabilitaram → agora funcionais.
- [x] Botão ✏ no cartão da lista abre modal em modo editar.
- [x] `criado_por` = `supabase.auth.getUser().email` (fallback `'sistema'`).

### Sprint 3-B — Gerador de Orçamentos: 6 features
- [x] Numeração automática `ORC-NNN` — contador em `localStorage['verde-orc-contador']`, exibido no cabeçalho da proposta, só incrementa ao gerar com sucesso. Botão ↺ para resetar.
- [x] Salvamento de rascunho — `localStorage['verde-orc-rascunho']` com debounce 1500ms. Query string tem prioridade sobre rascunho ao carregar. Botão "🗑 Rascunho" limpa.
- [x] Validade automática — cabeçalho mostra `Validade: DD/MM/YYYY (30 dias)`, calculada dinamicamente.
- [x] Campos e-mail + telefone do cliente — inputs `#cli-email` e `#cli-telefone` + pré-preenchimento via query string.
- [x] Desconto global — campo `#desconto` (0-100%), atualiza subtotal/desconto/total em Investimento Único e Recorrente. Só aparece quando > 0.
- [x] Botão "🧹 Limpar tudo" — reset completo com confirm. Preserva contador ORC.
- [x] Arquivos `tools/orcamentos/verde_interior_gerador_orcamento_10.html` e `apps/crm/public/gerador-orcamento.html` mantidos idênticos.

### Sprint 3-C — OS HTML dinâmico (Opção B)
- [x] Removido hardcode Heimr. Parametrização via query string: `?cliente=&os=&endereco=&bairro=&contato=&telefone=&plantas=Nome:Local:Obs|...&modo=execucao|conclusao`.
- [x] Modo Execução: só slot "Antes" liberado. FAB "Finalizar Execução" só habilita quando todas as plantas têm foto Antes (alerta lista pendências).
- [x] Modo Conclusão: "Antes" trancado, "Depois" liberado. Alterna via botão "Voltar p/ Execução". Ao concluir tudo: tela de resumo com exportar JSON + imprimir.
- [x] Fotos WebP comprimidas via canvas (max 100KB, 1600px). Persistência em `localStorage['verde-os-<osId>']`.
- [x] Botões "Copiar link" e "QR" (modal com QR via api.qrserver.com).
- [x] Tela fallback "Selecione uma OS" quando sem query string.
- [x] Mobile-first: `capture="environment"`, grid 2 colunas, FAB fixo. Arquivos `tools/ordem de servico/...html` e `apps/crm/public/os.html` idênticos.

### Sprint 4 — Ponto Eletrônico

- [x] **Exportação XLSX** — instalado `xlsx` (SheetJS). `expXLSX(mode)` reusa dataset do CSV (`_buildExportDataset`) e gera `.xlsx` com larguras auto de coluna e nome de sheet (Espelho/Resumo/Banco). Botões novos no admin ao lado dos CSV.
- [x] **XSS escape** — nova função `esc()` em `utils.js`. Aplicada em: `admin.js` (pendentes de justificativa, obs de punch, `repbody`, dashboard de barras), `justs.js` (lista de justificativas do colab), `mirror.js` (nome/cargo no PDF), `config.js` (lista de equipe), `agenda.js` (consolidado — removido `esc` local duplicado).
- [x] **Auditoria** — migration `017_audit_log_ponto.sql`: tabela `public.audit_log` (entidade + entidade_id + acao + usuario_id/email + payload_antes/depois JSONB) + função genérica `audit_trigger()` (`SECURITY DEFINER`) + triggers em `punch_records` e `justifications`. Zero mudança de código cliente — auditoria automática. RLS: só gestor lê; log imutável.
- [x] **Relatório de frequência mensal** — `renderFrequencia()` no admin, tabela com dias previstos (seg-sex), faltas, atrasos (entrada > 08:20), saídas antecipadas (saída < 17:40) e % de adesão por colaborador. Usa período dos inputs `#rs`/`#re`.
- [x] **Gráfico de banco de horas** — `renderBankChart()` renderiza SVG inline (sem lib) com evolução dos últimos 6 meses. Uma linha por colaborador, com legenda. Grid horizontal em ±maxAbs, escala automática.

### Passos manuais para fechar Sprints 3+4

- [ ] **Aplicar migration 017 no Supabase:** dashboard → SQL Editor → colar `apps/ponto/supabase/migrations/017_audit_log_ponto.sql` → rodar. Testar com INSERT em `punch_records` e ver `SELECT * FROM audit_log ORDER BY criado_em DESC LIMIT 5`.
- [ ] Rebuild + deploy do CRM (Vercel puxa automaticamente do push).
- [ ] Testar no Ponto: gestor exportando XLSX (Espelho/Resumo/Banco). Verificar que abre no Excel com acentos.

### Ficam para próximas rodadas (precisam de infra)

- [ ] **Reset de senha via e-mail (colaborador)** — precisa: (a) coluna `email_recuperacao` em `profiles` (nullable — colaboradores sem email de verdade não podem usar); (b) configurar SMTP no Supabase Auth (dashboard → Auth → Emails → Custom SMTP); (c) UI "Esqueci minha senha" em `apps/ponto/index.html` chamando `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://ponto.verdeinterior.app/reset' })`; (d) rota `/reset` que chama `supabase.auth.updateUser({ password })`.
- [ ] **Gestor redefine senha de colaborador** — precisa Edge Function (não dá pra fazer via anon key). Passos: (a) `supabase functions new admin-reset-password`; (b) na Function, usar `createClient(url, SERVICE_ROLE_KEY)` + `auth.admin.updateUserById(id, { password: gerarSenhaTemp() })`; (c) UI no admin com botão "Redefinir senha" → mostra senha temporária pro gestor repassar. Alternativa sem Function: adicionar coluna `senha_temporaria` em `profiles` + trigger que força troca no primeiro login.

---

## ✅ Concluído em 20/07/2026 (Fase 4 — Sprint 5 parcial: tech debt viável)

### ESLint no CRM
- [x] `apps/crm/eslint.config.js` — flat config compatível com ESLint 9 + react + react-hooks + prettier.
- [x] `npm install -D eslint@^9 @eslint/js eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier` (com `--legacy-peer-deps`).
- [x] Scripts `lint`, `test`, `test:watch` no `package.json`.
- [x] Baseline: 1 erro + 15 warnings (a maioria são "unused vars" e "exhaustive-deps"). Rodar `npm run lint` no `apps/crm`.

### Vitest + primeiros testes

- [x] **CRM (`apps/crm/src/context/CRMContext.test.js`)** — 13 testes de helpers puros: `getTiposServico` (compat legado e novo), `getTipoPrimario`, `addDias` (com transição de mês/ano), `criarFluxoOrcamento` (T1 de 3 vs 6 dias com/sem visita, encadeamento T2/T3). Setup: `npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom --legacy-peer-deps`.
- [x] **Ponto (`apps/ponto/src/utils.test.js`)** — 11 testes das funções críticas: `calcWorkClosed` (jornada corrida, com intervalo, aberta, parcial), `HM` (positivo/negativo/zero), `esc` (XSS escape com aspas, `<`, `>`, `&`, null/undefined).
- [x] Ambos passam: `npm test` em cada pasta.

### Ficam como TODO explícito (grandes, precisam de várias iterações)

- [ ] **Refactor `EscalaCampo.jsx` (~2.500 linhas)** em subcomponentes: `EscalaGrid` (grid semanal), `EscalaCartao` (cartão de visita), `EscalaOtimizador` (otimizador de rota), `EscalaModalEdicao` (modal de edição), `EscalaRedistribuicao` (modal de redistribuir ausentes), `EscalaMapa` (mapa opcional). Estratégia recomendada: extrair um componente por vez, mantendo props explícitas + estados no pai, e rodar `npm run build` a cada extração. Não misturar com mudança de comportamento.
- [ ] **Refactor `ModalOrcamento.jsx` (~1.700 linhas)** em: `SecaoLead`, `SecaoAnexos`, `SecaoServicos`, `SecaoContrato`, `SecaoAgendaLead`, `SecaoFluxo`, `SecaoHistorico`. Mesma estratégia — extrair uma seção por vez com o estado do pai passado por props/callbacks. Testes atuais do CRMContext ajudam a garantir que a lógica core não regride durante o refactor.
- [ ] **Ampliar cobertura de testes** — adicionar testes para o otimizador de rota em `EscalaCampo` (função pura de reordenação com restrições de janela/dias) e para `promoverParaCliente` (mocking do supabase-js).
- [ ] **Corrigir os 15 warnings do ESLint no CRM** (maior parte: `exhaustive-deps` em useMemos com dependências propositalmente omitidas, e `unused vars` que podem ser removidos).

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
