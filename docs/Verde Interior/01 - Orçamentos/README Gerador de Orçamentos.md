# Gerador de Orçamentos — Status Atual

**Arquivo:** `tools/orcamentos/verde_interior_gerador_orcamento_10.html` (979 linhas)
**Stack:** HTML único, offline, sem dependências externas
**Fontes:** Inter + Montserrat (Google Fonts)
**Status:** 🟡 Funcionando — congelado desde 22/jun/2026, 3 bugs + 6 features essenciais pendentes
**Última atualização da doc:** 20/07/2026

---

## O que funciona

- Painel lateral (formulário) + preview em tempo real do documento
- Página 1: proposta comercial com tabela de itens, subtotais, condições
- Página 2: galeria de fotos (Anexo)
- Logo da Verde Interior embutido em base64
- Campo "AC:" (Aos Cuidados de) no cabeçalho
- Consultor visível apenas no painel interno, não no impresso
- Título do documento editável inline, duplo-clique para resetar

## 7 modelos de serviço

| Modelo | Regras especiais |
|---|---|
| Venda de Vasos e Plantas / Implantação | — |
| Reforma de Vasos e Plantas | — |
| Locação de Vasos e Plantas | Auto-ativa Manutenção de Vasos e Plantas + Fidelidade obrigatória |
| Manutenção de Vasos e Plantas | — |
| Manutenção Pontual | Opção de frequência Pontual |
| Locação de Vasos e Plantas para Eventos | Campos de entrega e retirada |
| Outros Serviços | — |

**Lógica de reposição:** Locação → trava em "ilimitado". Outros → toggle quantidade/ilimitado.

---

## Bugs confirmados no código atual

1. **Proposta gerada sem itens** — `gerarProposta()` não valida `itens.length === 0`; documento sai vazio sem aviso
2. **Override do título editável** — `if(!tituloEl.dataset.customizado){...}` (L749) impede resetar após edição manual; conflito de listeners `input` + `dblclick` (L967-975)
3. **Toggle reposição não sincroniza** ao trocar de modelo (L713-741)

## Features essenciais pendentes

- Numeração automática de propostas (`ORC-NNN`)
- Rascunho em localStorage
- Data de validade automática (+30 dias)
- Campos de e-mail e telefone do cliente
- Desconto global
- Botão "limpar tudo"

## Próxima ação

Corrigir os 3 bugs primeiro (impacto comercial diário), depois as 6 features essenciais.
Ver roadmap completo → [[roadmap]] e [[PROXIMOS-PASSOS]].
