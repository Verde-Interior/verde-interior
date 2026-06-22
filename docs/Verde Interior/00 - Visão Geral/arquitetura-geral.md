# Arquitetura Geral — Verde Interior

> Documento de referência do projeto. Atualizar sempre que uma decisão estrutural for tomada.
> Última atualização: junho 2026

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
- **Repositório:** https://github.com/ferworks93-weed/verde-interior-pwa
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
- **Status:** início — estrutura criada, sem componentes implementados ainda
- **Stack:** React + JSX (Vite)
- **Deploy:** ainda não
- **Pasta local:** `apps/crm/`

**O que fará:**
- Funil Kanban com 5 estágios (leads → aprovados)
- Gestão de contratos ativos (Locação e Manutenção)
- Roteirizador de visitas por bairro e frequência
- Solicitação de reposição de plantas
- Controle de agenda

**Backlog mapeado:** ver [[04 - CRM Dashboard/README]]

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

**Decisão pendente:** sistema de fotos — Opção A (slots simples) ou Opção B (dois modos: Execução/Conclusão)

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

- [x] ~~Sistema de fotos da OS~~ — Opção B escolhida
- [x] ~~Formato do ID único de cliente~~ — `CLI-NNN`, `ORC-NNN`, `OS-NNN` (sequencial por entidade)
- [x] ~~Status do orçamento que dispara criação de OS~~ — `orcamento_aprovado` gera OS automaticamente
- [ ] Design system visual unificado (paleta, tipografia, componentes)
