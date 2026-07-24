# Arquitetura Geral — Verde Interior

> Documento de referência do projeto. Atualizar sempre que uma decisão estrutural for tomada.
> Última atualização: 23/07/2026

---

## Visão do projeto

Construir uma **plataforma operacional integrada** para a Verde Interior Paisagismo, unificando controle de equipe, gestão comercial, execução de serviços e finanças em um único sistema interno.

**Estratégia:** modular primeiro, unificar depois. Cada módulo é desenvolvido de forma independente com padrões comuns, para que a unificação futura seja montar peças compatíveis, não reescrever tudo.

---

## Módulos existentes

### 1. Ponto Eletrônico
- **Status:** produção
- **Stack:** Vite + JavaScript ES Modules + Supabase (PostgreSQL + Auth + Storage)
- **Deploy:** Vercel — https://verde-interior-pwa.vercel.app
- **Repositório:** https://github.com/Verde-Interior/verde-interior (pasta `apps/ponto/`)
- **Tipo:** PWA (Progressive Web App) — funciona offline, instalável no celular
- **Pasta local:** `apps/ponto/`

**O que faz:**
- Colaboradores batem ponto (entrada, intervalo, retorno, saída)
- Geolocalização registrada em cada batida
- Banco de horas automático com saldo, extras e devidas
- Espelho mensal com impressão
- Justificativas com upload de anexos
- Gestor: dashboard, mapa de localizações, edição de registros, exportação CSV
- Notificações browser de lembrete

**Equipe cadastrada:** Beto, Brenno, Bruno, Carlos, Greg, Miriam, Pedro Silva, Peterson

---

### 2. CRM / Dashboard
- **Status:** deployado e operacional — 10 módulos ativos
- **Stack:** React 18 + JSX (Vite) + ESLint 9 flat config + Vitest
- **Deploy:** Vercel (auto via GitHub, `apps/crm/vercel.json`)
- **Pasta local:** `apps/crm/`

**O que faz:**
- **Pipeline / Kanban** com 5 estágios, **multi-tipo de serviço por lead** (016), delete via UI
- **Funil de Execução** para contratos ativos (materiais → pós-venda)
- **Dashboard** com KPIs, range de datas, agenda e relatórios integrados. Follow-up separa "ação pendente" (borda verde) de "🕐 só lembrete" (borda cinza)
- **Clientes** — CRUD com dias disponíveis, janelas, frequência, completude; 120 clientes importados (023); merge duplicados (024)
- **Ordens de Serviço** — lista com `os_id` real (OS-NNN), criado automaticamente ao aprovar orçamento
- **Escala de Campo** — otimizador de rota (corrigido para usar `janela_entrada_inicio`), drag & drop **atômico via RPC `reorder_agenda`** (015), tooltips, prioridade/bloqueios, **aceita visitas de lead** (badge "🌱 lead", 016), visitas canceladas ocultas no App Ponto
- **Relatórios** — visualização de fotos, assinatura, GPS, reverse geocoding
- **Agenda** — calendário + sidebar
- **Tarefas** — CRUD com prioridade, categoria, vínculo com lead
- **Estoque v2** — 5 abas:
  - **Plantas** — espécies do catálogo com quantidades derivadas de `estoque_especies_resumo` (disponíveis, no cliente, manutenção, descartadas)
  - **Insumos / Vasos / Materiais** — ItensTab compartilhada com CRUD + movimentações
  - **QR Codes** — gera VI-xxxx, exibe QR visual, imprime etiqueta, atribui espécie
- Busca global (Cmd+K), autenticação Supabase
- **Scan mobile:** `?patrimonio=VI-xxxx` na URL abre `ModalAtribuirQR` automaticamente

**Persistência (tudo no Supabase agora):**
- Escrita: `leads`, `tarefas` (015), `clientes`, `cliente_servicos`, `agenda` (com `lead_id`, 016), `relatorios`, `fotos_relatorio`, `employee_bloqueios`, `estoque_especies`, `estoque_patrimonios`, `estoque_eventos`, `estoque_manutencoes`, `estoque_itens`, `estoque_itens_movs`
- Leitura: `employees`, `estoque_patrimonios_view`, `estoque_especies_resumo`, `estoque_itens_saldo_total`, `estoque_itens_saldo_titular`, `audit_log` (só gestor)
- Cache local: `localStorage['crm-verde-leads' | 'crm-verde-tarefas']` — apenas rendering rápido + fallback offline
- Deprecated (mantidas no banco por compat com legado): `materiais`, `estoque_movimentacoes`

**Backlog:** ver [[README CRM Dashboard]] e [[PROXIMOS-PASSOS]]

---

### 3. Gerador de Orçamentos
- **Status:** ✅ 3 bugs corrigidos + 6 features essenciais + integração com CRM via query string
- **Stack:** HTML único, sem dependências externas
- **Tipo:** arquivo local **e** servido pelo Vite do CRM (dois arquivos idênticos, sincronizados)
- **Pasta local:** `tools/orcamentos/verde_interior_gerador_orcamento_10.html` e `apps/crm/public/gerador-orcamento.html`

**O que faz:**
- 7 modelos de serviço com regras de negócio específicas
- Preview em tempo real do documento
- Lógica de reposição de plantas (ilimitado para Locação)
- Campo "AC:" e título editável inline
- Impressão direta via browser
- **Numeração automática `ORC-NNN`** (localStorage), rascunho auto-save, validade +30d, email/telefone, desconto global, botão limpar tudo
- **Integração com CRM:** botão "🛠 Gerar orçamento" no `ModalOrcamento` abre em nova aba com pré-preenchimento por query string

Ver [[README Gerador de Orçamentos]] para detalhes.

---

### 4. Ordem de Serviço (OS)
- **Status:** ✅ Dinâmica, parametrizada por query string, modo Execução/Conclusão implementado (Opção B, 22/jun)
- **Stack:** HTML único, sem dependências externas (QR via API pública)
- **Tipo:** arquivo local **e** servido pelo Vite do CRM (idênticos)
- **Pasta local:** `tools/ordem de servico/plano-execucao-heimr_10.html` (nome legado — arquivo é dinâmico) e `apps/crm/public/os.html`

**O que faz:**
- Parametrização via query string: `?cliente=&os=&plantas=Nome:Local:Obs|...&modo=execucao|conclusao`
- **Modo Execução:** só "Antes" liberado; FAB "Finalizar" só habilita quando todas as plantas têm foto Antes
- **Modo Conclusão:** "Antes" trancado, "Depois" liberado; alterna via botão. Ao concluir, tela de resumo com exportar JSON + imprimir
- Fotos WebP <100KB via canvas, persistidas em `localStorage['verde-os-<os_id>']`
- Botões "Copiar link" e "QR" (via api.qrserver.com)
- Mobile-first: `capture=environment`, grid 2 colunas, FAB fixo
- Tela fallback "Selecione uma OS" quando sem query string

Ver [[README Ordem de Serviço]] para exemplos de URL.

---

## Plataforma unificada (visão futura)

Quando os módulos estiverem maduros, a unificação será feita com:

- **Hub central** com login único (gestor e colaborador)
- **Base de dados compartilhada** — clientes, funcionários, histórico, banco de mídias
- **Fluxo automático:** orçamento aprovado → gera OS → vincula ponto → alimenta financeiro
- **CRM como shell principal** — os outros módulos entram como rotas dentro do React

### Perfis de acesso planejados

| Perfil | Acesso |
|---|---|
| Gestor | Total — todos os módulos |
| Colaborador | OS, Ponto, Fotos |
| Cliente (futuro) | Visualizar OS, aprovar serviços |

---

## Estrutura de pastas no computador

```
verdeinterior-newproject/
│
├── apps/
│   ├── ponto/          ← PWA (Vite + Supabase) — produção no Vercel
│   └── crm/            ← React (Vite) — em desenvolvimento
│
├── tools/
│   ├── orcamentos/     ← HTML único, sem build
│   └── ordem-de-servico/ ← HTML único, sem build
│
└── docs/
    └── Verde Interior/
        ├── README.md            ← índice central
        ├── 00 - Visão Geral/    ← arquitetura, decisões
        ├── 01 - Orçamentos/
        ├── 02 - Ponto Eletrônico/
        ├── 03 - Ordem de Serviço/
        ├── 04 - CRM Dashboard/
        ├── 05 - Plataforma Unificada/
        └── 06 - Padrões Comuns/
```

---

## Migrations

28 migrations aplicadas. Canal oficial: **Supabase CLI** (`supabase db push`). Nunca mais pelo SQL Editor manual.

```bash
cd apps/ponto
supabase link --project-ref mcaqxfogzvrqqnoixptv
supabase db push
```

---

## Decisões críticas já tomadas

- Estratégia modular primeiro, unificar depois
- HTML puro para tools (sem frameworks)
- React para apps com estado complexo (CRM)
- Supabase como backend para apps com persistência
- Vite como build tool padrão
- Deploy via Vercel + GitHub
- **Supabase CLI** como único canal para aplicar migrations (23/07/2026)
- **QR patrimônio** (VI-xxxx) como identidade física permanente — `qr_codigo` imutável; espécie pode mudar (23/07/2026)

## Decisões ainda abertas

- [x] ~~Sistema de fotos da OS~~ — Opção B escolhida e **implementada** (sprint 3-C, 20/07/2026)
- [x] ~~Formato do ID único de cliente~~ — `CLI-NNN`, `ORC-NNN`, `OS-NNN` (sequencial por entidade)
- [x] ~~Status do orçamento que dispara criação de OS~~ — `orcamento_aprovado` gera OS automaticamente
- [x] ~~Multi-tipo de serviço no lead~~ — array (016)
- [x] ~~Agenda vinculada a lead ou cliente~~ — cliente_id nullable + lead_id + check (016)
- [x] ~~Auditoria de edições no Ponto~~ — trigger genérico em audit_log (017)
- [x] ~~Estoque de plantas vs QR Codes~~ — separados em abas distintas; Plantas usa `estoque_especies_resumo` (quantidades derivadas); QR gerencia patrimônios físicos (023-028)
- [ ] Design system visual unificado (paleta, tipografia, componentes)
- [ ] Estratégia de roles no CRM (`gestor`, `colab`, `campo`) e proteção de rotas — **adiado** até algum colaborador de campo precisar entrar no CRM
- [ ] Refactor de `EscalaCampo.jsx` e `ModalOrcamento.jsx` em subcomponentes (dias de trabalho, iterativo)
- [ ] Reset de senha via e-mail (precisa SMTP no Supabase Auth) e gestor redefinir senha (Edge Function pronta, falta SMTP)
- [ ] Momento de migrar os HTMLs (Orçamentos, OS) para módulos React dentro do CRM (Plataforma Unificada)
