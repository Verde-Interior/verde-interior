# Gerador de Orçamentos — Status Atual

**Arquivo:** `tools/orcamentos/verde_interior_gerador_orcamento_10.html`
**Stack:** HTML único, offline, sem dependências externas
**Fontes:** Inter + Montserrat (Google Fonts)
**Status:** 🟡 Funcionando — melhorias pendentes

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

## Próxima ação

Escolher uma das três opções:

- **A)** Corrigir 3 bugs prioritários (rápido)
- **B)** Implementar 6 funcionalidades essenciais (resultado comercial imediato)
- **C)** Definir design system antes de evoluir (consistência com outros módulos)

Ver roadmap completo → [[roadmap]]
