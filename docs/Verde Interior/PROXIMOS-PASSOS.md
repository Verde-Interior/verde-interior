# Verde Interior — Próximos Passos

> Documento de trabalho da equipe. Marcar conforme concluir.
> Última atualização: 23/07/2026 — Estoque v2 + QR Codes completo

---

## ✅ Concluído em 23/07/2026 — Estoque v2 + QR Codes

### Estoque v2 — Schema + UI completamente refeitos (migrations 025-028)

- [x] Migration `025_estoque_v2_schema.sql`:
  - Tabelas: `estoque_especies`, `estoque_patrimonios`, `estoque_eventos`, `estoque_manutencoes`, `estoque_itens`, `estoque_itens_movs`
  - Sequência `patrimonio_qr_seq` + função `gerar_qr_codigo_patrimonio()` → VI-0001, VI-0002...
  - Views: `estoque_patrimonios_view`, `estoque_especies_resumo`, `estoque_itens_saldo_total`, `estoque_itens_saldo_titular`
  - Trigger `atualizado_em` em `estoque_patrimonios`, RLS em todas as tabelas
  - Event sourcing em `estoque_eventos` (11 tipos: cadastro, entrada, saída, instalação, retirada, troca_especie, manutencao_inicio/fim, descarte, transferencia, observação)

- [x] Migration `026_estoque_especies_iniciais.sql`:
  - 37 espécies cadastradas (catálogo inicial)
  - 260 patrimônios individuais VI-0001 → VI-0260, todos `disponivel`, com evento `cadastro`

- [x] Migration `027_estoque_migra_legado.sql`:
  - `materiais` → `estoque_itens` (remapeamento de categoria)
  - `estoque_movimentacoes` → `estoque_itens_movs`
  - Views antigas (`estoque_saldos_totais`, `estoque_saldos_por_titular`) dropadas

- [x] Migration `028_patrimonio_especie_nullable.sql`:
  - `especie_id` em `estoque_patrimonios` se torna nullable (QR pode ser gerado sem espécie definida)
  - View `estoque_patrimonios_view` atualizada para LEFT JOIN

- [x] CRM — UI Estoque v2 com **5 abas**:
  - **Plantas** — lista espécies com quantidade total derivada de `estoque_especies_resumo` (disponíveis, no cliente, manutenção)
  - **Insumos / Vasos / Materiais** — ItensTab compartilhada com `estoque_itens_saldo_total`, CRUD + movimentações
  - **QR Codes** — gera VI-xxxx, exibe QR visual (`qrcode.react`), imprimir etiqueta, atribuir espécie

- [x] Scan mobile: `?patrimonio=VI-xxxx` na URL abre `ModalAtribuirQR` automaticamente — seleciona espécie e salva evento `troca_especie`

- [x] Supabase CLI configurado e migrations futuras podem ser aplicadas via `supabase db push` (todas as 028 aplicadas)

---

## ✅ Concluído em 21/07/2026 — Refactor + Infra

### Fase 3 — Refactor EscalaCampo (2456 → 879 linhas, −64%)
- [x] Utils: `otimizadorRota.js` + `escalaHelpers.js`
- [x] 11 testes (`otimizadorRota.test.js`)
- [x] Componentes: `CartaoVisita`, `ModalAddVisita`, `ModalEditVisita`, `ModalPreviewRota`, `ModalRedistribuir`, `ModalBloqueios`, `PainelAtrasados`, `ModalCopiarAgenda`
- [x] Fix otimizador: usa `janela_entrada_inicio` em vez de `hora_estimada_chegada` salva (commit 180201a)
- [x] Visitas canceladas ocultas do App Ponto (commit 7ebb341)

### Fase 4.1 — Refactor ModalOrcamento (parcial)
- [x] `SecaoHistorico.jsx` extraída
- [ ] SecaoAnexos, SecaoAgendaLead, SecaoFluxo, SecaoLead — **pendentes** (estado compartilhado profundo)

### Fase 5 — Reset de senha (código pronto, falta SMTP)
- [x] Migration 018: `profiles.email_recuperacao`
- [x] `solicitarResetSenha()` em `auth.js`
- [x] `apps/ponto/public/reset.html`
- [x] Edge Function `admin-reset-password/index.ts`
- [ ] **FALTA:** configurar SMTP no Supabase Dashboard → Auth → Emails
- [ ] Adicionar UI "Esqueci minha senha" em `apps/ponto/index.html`
- [ ] Popular `profiles.email_recuperacao` por colaborador
- [ ] `supabase functions deploy admin-reset-password`

### Fase 6 — IDs únicos + Ordens de Serviço
- [x] Migration 019: sequências `seq_cliente_id`, `seq_orcamento_id`, `seq_os_id`
- [x] `clientes.cli_id` (CLI-NNN), `leads.orc_id` (ORC-NNN)
- [x] Tabela `ordens_servico` com trigger automático em `orcamento_aprovado`
- [x] UI `OrdensServico.jsx` listando OS com `os_id` real
- [x] Clientes: migration 022 (grupos renomeados) + 023 (120 clientes importados) + 024 (merge duplicados)

---

## ✅ Concluído em 20/07/2026 — Sprint 1-5

### Ponto → CRM: Leads + tarefas no Supabase (015)
- [x] Tabelas `leads` e `tarefas`, RLS, `CRMContext.jsx` fala com Supabase

### Multi-tipo de serviço + agenda-a-partir-de-lead (016)
- [x] `leads.tipos_servico TEXT[]`, helpers `getTiposServico/getTipoPrimario`
- [x] `agenda.lead_id` nullable, constraint exclusivo `cliente XOR lead`
- [x] Badge "🌱 lead" na Escala

### ESLint + Vitest (Sprint 5)
- [x] ESLint 9 flat config no CRM
- [x] 24 testes: 13 em `CRMContext.test.js`, 11 em `utils.test.js` (Ponto)

### Sprint 3-4: Estoque v1, Orçamentos, OS, Ponto
- [x] Estoque v1: ModalMaterial + ModalMovimento (migration 013 — agora migrado para v2)
- [x] Gerador ORC-NNN: numeração, rascunho, validade, email, telefone, desconto, limpar tudo
- [x] OS dinâmica: modo Execução/Conclusão, parametrizado, QR
- [x] Ponto: XLSX (SheetJS), XSS escape, auditoria (017), frequência, gráfico banco de horas

---

## Estado geral — 23/07/2026

| Módulo | Status | O que sobra |
|---|---|---|
| **Ponto Eletrônico** | ✅ Produção, maduro | Reset de senha (falta SMTP) |
| **CRM** | ✅ Deployado, 9 módulos + Estoque v2 + QR | Refactors EscalaCampo/ModalOrcamento |
| **Escala de Campo** | ✅ Otimizador corrigido, canceladas ocultas | — |
| **Estoque** | ✅ v2 com 4 abas + QR Codes + scan mobile | Aba QR: eventos de instalação/retirada |
| **Gerador de Orçamentos** | ✅ 6 features + integração CRM | — |
| **OS (HTML)** | ✅ Modo Execução/Conclusão dinâmico | Integração com backend |
| **Ordens de Serviço (CRM)** | ✅ Lista com os_id real | Edição inline, vinculação campo |

---

## Pendente agora

### Reset de senha (80% pronto)
- [ ] Configurar SMTP no Supabase Dashboard → Auth → Emails → Custom SMTP
- [ ] Popular `profiles.email_recuperacao` para cada colaborador
- [ ] UI "Esqueci minha senha" em `apps/ponto/index.html`
- [ ] `supabase functions deploy admin-reset-password`

### Estoque — próximas iterações

#### QR Codes — completar fluxo de campo
- [ ] Na aba QR: botão "Registrar evento" (instalação, retirada, manutenção) a partir do patrimônio
- [ ] Filtrar patrimônios por cliente (onde a planta foi instalada)
- [ ] Página pública `/patrimonio/:codigo` no App Ponto (scan sem login)

#### Espécies
- [ ] Campo `estoque_minimo` por espécie (alerta quando disponível cai abaixo de N)
- [ ] Categoria separada para espécies de evento (locação temporária)

### Tech debt — Refactors pendentes
- [ ] **EscalaCampo.jsx** (~879 linhas — já refatorado 64%, mas ainda extenso): extrair `EscalaGrid`, `EscalaCartao`, `EscalaOtimizador`
- [ ] **ModalOrcamento.jsx** (~1.700 linhas): SecaoAnexos, SecaoAgendaLead, SecaoFluxo, SecaoLead
- [ ] Corrigir 15 warnings ESLint (exhaustive-deps, unused vars)
- [ ] Ampliar cobertura de testes (promoverParaCliente, otimizador com janelas)

### CRM — UX pendente
- [ ] Exportação CSV real (hoje `exportarDados()` gera JSON com extensão `.csv`)
- [ ] Deletar campo legado `orcamentoAnexo` singular (coexiste com array `orcamentoAnexos`)
- [ ] `FunilExecucao`: UI de cadastro/edição de materiais

---

## Futuro — Plataforma Unificada

- [ ] Migrar Gerador de Orçamentos (HTML) para módulo React no CRM
- [ ] Migrar OS (HTML) para módulo React no CRM
- [ ] OS vinculada ao ponto do colaborador responsável
- [ ] Dashboard financeiro com margem por tipo de serviço
- [ ] Banco de mídias (galeria Antes/Depois para marketing)
- [ ] Portal do cliente

---

## Setup do ambiente

```bash
# CRM
cd apps/crm && npm install && npm run dev   # http://localhost:5173

# Ponto Eletrônico
cd apps/ponto && npm install && npm run dev

# Migrations — nunca mais manual, agora via CLI:
cd apps/ponto
supabase link --project-ref mcaqxfogzvrqqnoixptv
supabase db push
```

**OS e Orçamentos:** abrir `.html` diretamente no navegador, sem instalação.

---

## Regras que não mudar sem discussão

- Credenciais Supabase — rotacionar só com todos cientes e atualizar Vercel junto
- Nomes dos funcionários — são chaves no banco do Ponto
- Fluxo de ponto: `entry → break → return → exit`
- Lógica de `calcWork` / `calcWorkClosed` no Ponto
- Paleta de cores — deriva do logo da empresa
- `qr_codigo` dos patrimônios — imutável após criação (VI-xxxx nunca muda)

Decisões novas → registrar em [[00 - Visão Geral/decisoes-importantes]]
Design system → atualizar [[06 - Padrões Comuns/padroes-comuns]]
