# Arquitetura Geral — Verde Interior

> Documento de referência do projeto. Atualizar sempre que uma decisão estrutural for tomada.
> Última atualização: 20/07/2026

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
- **Status:** deployado e operacional — 9 módulos ativos
- **Stack:** React 18 + JSX (Vite)
- **Deploy:** Vercel (auto via GitHub, `apps/crm/vercel.json`)
- **Pasta local:** `apps/crm/`

**O que faz:**
- **Pipeline / Kanban** com 5 estágios (leads → aprovados)
- **Funil de Execução** para contratos ativos (materiais → pós-venda)
- **Dashboard** com KPIs, range de datas, agenda e relatórios integrados
- **Clientes** — CRUD com dias disponíveis, janelas, frequência, completude
- **Escala de Campo** — otimizador de rota, drag & drop, tooltips, prioridade/bloqueios (Fase 5.2 nível 2)
- **Relatórios** — visualização de fotos, assinatura, GPS, reverse geocoding (Fase 4)
- **Agenda** — calendário + sidebar
- **Tarefas** — CRUD com prioridade, categoria, vínculo com lead
- **Estoque** — Etapa 1: lista + KPIs (CRUD pendente na Etapa 2)
- Busca global (Cmd+K), autenticação Supabase

**Persistência:**
- Supabase (leitura + escrita): `clientes`, `cliente_servicos`, `agenda`, `relatorios`, `fotos_relatorio`, `employee_bloqueios`
- Supabase (leitura): `employees`, `estoque_saldos_totais`
- ⚠️ **localStorage ainda**: `crm-verde-leads`, `crm-verde-tarefas` — migração pendente ([[PROXIMOS-PASSOS]])

**Backlog:** ver [[README CRM Dashboard]] e [[PROXIMOS-PASSOS]]

---

### 3. Gerador de Orçamentos
- **Status:** funcionando, melhorias pendentes
- **Stack:** HTML único, sem dependências externas
- **Tipo:** arquivo local, aberto diretamente no navegador
- **Pasta local:** `tools/orcamentos/`

**O que faz:**
- 7 modelos de serviço com regras de negócio específicas
- Preview em tempo real do documento
- Lógica de reposição de plantas (ilimitado para Locação)
- Campo "AC:" e título editável inline
- Impressão direta via browser

**20 melhorias mapeadas:** ver `01 - Orçamentos/roadmap.md`

---

### 4. Ordem de Serviço (OS)
- **Status:** funcionando na web, adaptação mobile em andamento
- **Stack:** HTML único, sem dependências externas
- **Tipo:** arquivo local, aberto diretamente no navegador
- **Pasta local:** `tools/ordem-de-servico/`

**O que faz (versão atual — baseada no Heimr):**
- Cabeçalho com dados do cliente e tipo de serviço
- Tabela de plantas com operações (nova, substituição, preenchimento, cortesia)
- Lista de insumos técnicos
- Roteiro de execução passo a passo com alertas
- Sistema de fotos com tag de momento (Antes/Depois) e área
- Checklist de conclusão
- Assinatura do líder e do responsável do cliente
- Campo de observações finais

**Decisão tomada (22/06/2026):** sistema de fotos — Opção B (dois modos: Execução/Conclusão)
**Pendente:** implementar o modo dinâmico no HTML (hoje ainda hardcoded para o cliente Heimr)

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

## Decisões críticas já tomadas

- Estratégia modular primeiro, unificar depois
- HTML puro para tools (sem frameworks)
- React para apps com estado complexo (CRM)
- Supabase como backend para apps com persistência
- Vite como build tool padrão
- Deploy via Vercel + GitHub

## Decisões ainda abertas

- [x] ~~Sistema de fotos da OS~~ — Opção B escolhida (implementação pendente)
- [x] ~~Formato do ID único de cliente~~ — `CLI-NNN`, `ORC-NNN`, `OS-NNN` (sequencial por entidade)
- [x] ~~Status do orçamento que dispara criação de OS~~ — `orcamento_aprovado` gera OS automaticamente
- [ ] Design system visual unificado (paleta, tipografia, componentes)
- [ ] Estratégia de roles no CRM (`gestor`, `colab`, `campo`) e proteção de rotas
- [ ] Momento de migrar os HTMLs (Orçamentos, OS) para módulos React dentro do CRM
