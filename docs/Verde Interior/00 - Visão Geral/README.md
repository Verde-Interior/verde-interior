# Visão Geral — Verde Interior

> Ponto de entrada da pasta `00 - Visão Geral/`. Contém arquitetura e histórico de decisões.

---

## Arquivos desta pasta

| Arquivo | Conteúdo |
|---|---|
| [[arquitetura-geral]] | Stack, módulos, banco de dados, estrutura de pastas |
| [[decisoes-importantes]] | Log cronológico de decisões estruturais (nunca deletar) |

---

## Resumo da arquitetura

**Estratégia:** modular primeiro, unificar depois.

| Tipo | Stack | Módulos |
|---|---|---|
| Tool simples | HTML único | Orçamentos, OS |
| App com estado | React + Vite | CRM |
| App com persistência | Vite + JS + Supabase | Ponto Eletrônico |
| Plataforma unificada | React shell + Supabase | Futuro |

→ Ver detalhes completos em [[arquitetura-geral]]
