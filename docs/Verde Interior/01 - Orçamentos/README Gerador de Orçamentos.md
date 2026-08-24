# Gerador de Orçamentos — Estado do Código

**Última atualização da doc:** 24/08/2026
**Requisitos:** [[REQUISITOS-REFORMA]] — entrevista completa (Blocos 1–11) e backlog priorizado.

> ⚠️ Até 20/07/2026 o gerador era um **HTML standalone** (`tools/orcamentos/verde_interior_gerador_orcamento_10.html`, ~1,4 MB). Ele foi **substituído** por um módulo React dentro do CRM. O arquivo antigo continua no repo apenas como referência; **não está mais em uso e não é mais mantido**.

---

## Onde vive

| Peça | Caminho |
|---|---|
| Lista de orçamentos | `apps/crm/src/components/Orcamentos/Orcamentos.jsx` |
| Editor | `apps/crm/src/components/Orcamentos/GeradorOrcamento/GeradorOrcamento.jsx` |
| Preview / documento A4 | `apps/crm/src/components/Orcamentos/OrcamentoPreview/` |
| Modal de catálogo | `apps/crm/src/components/Orcamentos/CatalogoModal/` |
| Templates por serviço (Configurações) | `apps/crm/src/components/Configuracoes/TemplatesOrcamento/` |
| Helpers | `apps/crm/src/lib/orcamento-templates.js`, `orcamento-titulo.js` |
| Schema | `apps/ponto/supabase/migrations/040`–`047` |
| Seed do catálogo | `tools/seed-catalogo/seed-catalogo.mjs` |

**Stack:** React + Supabase. Não há dependência de PDF nesta feature — a saída é `window.print()` com CSS de impressão.

**Status:** funcional de ponta a ponta, **ainda sem commit** (~2.700 linhas). Migrations 040–046 já aplicadas em produção; a **047 ainda precisa ser rodada**.

---

## O que funciona

- **Aba Orçamentos** no menu lateral do CRM (`App.jsx`).
- **Lista** com busca, filtro por status e por tipo, e 4 métricas (em aberto, aprovados, valor em aberto, taxa de aprovação).
- **Editor em duas colunas**: formulário à esquerda, proposta e seções à direita, com **auto-save a cada 2s**.
- **7 tipos de serviço multi-seleção**: venda · reforma · locação · manut-rec · manut-pont · eventos · outros. Locação ativa e trava manutenção.
- **Painel condicional por serviço**: prazo e frequência (locação), reposição estruturada e desconto de localização (manutenção), data/hora de entrega e retirada + estacionamento + trabalho noturno (eventos).
- **Catálogo de plantas com fotos**, com troca automática da foto ao mudar cor/modelo/tamanho do vaso.
- **Preview A4 editável inline** — clicar no texto edita; duplo-clique no título volta ao automático.
- **Galeria de fotos** como página 2 do documento.
- **Numeração `ORC-NNN`** automática por trigger no banco, ao marcar como enviado.
- **Templates de descrição por tipo de serviço** editáveis em Configurações.
- **Integração com o Pipeline**: "Gerar orçamento" no card do lead abre o editor pré-preenchido; arrastar o lead para "Orçamento Aprovado" pergunta qual orçamento foi aprovado e marca o status.

## Modelo de dados

`orcamentos` (cabeçalho) → `orcamento_opcoes` (proposta principal + seções) → `orcamento_itens` (produtos, custos extras e blocos de imagem). Mais `catalogo_itens` e `orcamento_templates_servico`.

A **categoria de serviço vive na seção**, não no cabeçalho: `categoria_servico ∈ {locacao, manut-rec}` faz a seção entrar como **recorrente mensal**; qualquer outra entra como **investimento único**.

## Migrations

| # | O que faz |
|---|---|
| 040 | `catalogo_itens` |
| 041 | `orcamentos`, `orcamento_opcoes`, `orcamento_itens` |
| 042 | `dados_servico`, cor e tamanho do vaso, `is_principal` |
| 043 | `nome_planta`, `tipo_secao`, `preview_overrides` |
| 044 | `modelo_vaso` |
| 045 | multi-serviço (`tipos_servico[]`), `categoria_servico` por seção, numeração ORC, desconto, origem, galeria, `orcamento_templates_servico` |
| 046 | corrige o trigger de numeração para `BEFORE INSERT OR UPDATE` |
| 047 | libera `tipo='imagem'` em `orcamento_itens` — **pendente de aplicação** |

## Correções de 24/08/2026

1. **Bloco de imagem não salvava, em silêncio.** `tipo='imagem'` violava o CHECK da 041 e o INSERT do item não checava erro. Migration 047 + `if (eIns) throw eIns` no `salvar()`.
2. **Manutenção recorrente cobrada como valor único.** A proposta principal não tinha seletor de `categoria_servico` — só as seções adicionais tinham — então caía sempre em `total_unico`. Adicionado o seletor, com default coerente com os tipos marcados e sufixo "/mês" nos totais quando a categoria é recorrente.

## Próximos passos

Ver o backlog priorizado em [[REQUISITOS-REFORMA]]. Os quatro primeiros:
1. Estacionamento e trabalho noturno somando no total (hoje são só texto no documento).
2. Múltiplas opções concorrentes (Opção 1 / Opção 2, cliente escolhe uma).
3. Redesenhar o preview em estilo apresentação.
4. Download direto do PDF em vez do diálogo de impressão.
