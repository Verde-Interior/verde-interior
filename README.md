# Verde Interior — Plataforma Digital

Sistema interno da Verde Interior Paisagismo Corporativo.

---

## Módulos

| Módulo | Status | Pasta | Deploy |
|---|---|---|---|
| Ponto Eletrônico | Produção | `apps/ponto/` | [verde-interior-pwa.vercel.app](https://verde-interior-pwa.vercel.app) |
| CRM / Dashboard | Em desenvolvimento | `apps/crm/` | — |
| Gerador de Orçamentos | Funcionando | `tools/orcamentos/` | local |
| Ordem de Serviço | Funcionando | `tools/ordem-de-servico/` | local |

## Estrutura

```
verdeinterior-newproject/
├── apps/
│   ├── ponto/     ← PWA (Vite + Supabase)
│   └── crm/       ← React 18 (Vite)
├── tools/
│   ├── orcamentos/
│   └── ordem-de-servico/
└── docs/
    └── Verde Interior/    ← documentação completa (Obsidian)
```

## Setup

**CRM:**
```bash
cd apps/crm
npm install
npm run dev
```

**Ponto:**
```bash
cd apps/ponto
npm install
npm run dev
```

**OS e Orçamentos:** abrir o `.html` diretamente no navegador.

## Documentação

Toda a documentação está em `docs/Verde Interior/`.

- [Visão geral e arquitetura](docs/Verde%20Interior/00%20-%20Visão%20Geral/arquitetura-geral.md)
- [Próximos passos e sprint atual](docs/Verde%20Interior/PROXIMOS-PASSOS.md)
- [Design system e padrões](docs/Verde%20Interior/06%20-%20Padrões%20Comuns/padroes-comuns.md)
