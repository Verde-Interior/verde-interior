# Gerador de Orçamentos — Status Atual

**Arquivos:**
- `tools/orcamentos/verde_interior_gerador_orcamento_10.html` — original standalone
- `apps/crm/public/gerador-orcamento.html` — cópia servida pelo Vite (idêntica). Os dois DEVEM ficar em sync (`cp` entre eles a cada mudança).

**Stack:** HTML único, offline, sem dependências externas
**Fontes:** Inter + Montserrat (Google Fonts)
**Status:** ✅ 3 bugs corrigidos + 6 features essenciais implementadas + integração com CRM via query string
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

## Bugs corrigidos (20/07/2026, commit sprint 1+2)

1. ✅ **Proposta gerada sem itens** — `gerarProposta()` agora valida `modelosAtivos` e `itensValidos.length === 0`, bloqueia com mensagem clara.
2. ✅ **Override do título editável** — listener `input` reseta ao vazio ou quando bate com `gerarTitulo()`; `title` no `dblclick` explica o comportamento.
3. ✅ **Toggle reposição não sincronizava** — `syncCamposCondicionais` agora reseta toggle e rádios ao entrar em Locação (força "quantidade específica").

## 6 features essenciais implementadas (20/07/2026, sprint 3-B)

1. ✅ **Numeração automática `ORC-NNN`** — contador em `localStorage['verde-orc-contador']`, exibido no cabeçalho. Só incrementa quando `gerarProposta()` passa validação. Botão ↺ para resetar.
2. ✅ **Salvamento de rascunho** — `localStorage['verde-orc-rascunho']` com debounce de 1500ms. Query string tem prioridade ao carregar (para não sobrepor pré-preenchimento do CRM). Botão "🗑 Rascunho" limpa.
3. ✅ **Data de validade automática** — cabeçalho mostra `Validade: dd/mm/yyyy (30 dias)`, calculada dinamicamente.
4. ✅ **Campos de e-mail e telefone do cliente** — `#cli-email` e `#cli-telefone` na seção Cliente, pré-preenchimento via query string.
5. ✅ **Desconto global** — campo `#desconto` (0-100%). Aplica subtotal → desconto → total em Investimento Único e Recorrente. Só aparece quando > 0.
6. ✅ **Botão "🧹 Limpar tudo"** — reset completo com confirm forte. Preserva o contador de ORC (para não colidir depois).

---

## Integração com o CRM (20/07/2026)

Agora o botão "🛠 Gerar orçamento" no `ModalOrcamento` do CRM abre o gerador em nova aba com pré-preenchimento. URL:

```
/gerador-orcamento.html?empresa=X&contato=Y&bairro=Z&telefone=T&email=E&servico=locacao&qtd_vasos=12&valor=1200&frequencia=Mensal
```

O gerador lê os query params no `DOMContentLoaded` e preenche os campos correspondentes + ativa o modelo (`toggleM(...)`) do serviço primário do lead.

Mapeamento tipoServico do CRM → modelo do gerador:
- `venda` → `venda`
- `reforma` → `reforma`
- `locacao` → `locacao`
- `locacao_evento` → `eventos`
- `manutencao` → `manut-rec`

## Próxima ação

Ver [[PROXIMOS-PASSOS]]. Do gerador especificamente:
- (nice-to-have) Ler o `tipos_servico` array e pré-marcar múltiplos modelos quando lead tem mais de um tipo.
- (nice-to-have) Após gerar PDF, sinalizar de volta ao CRM (via `postMessage` ou parâmetro `?return_to=...`) que o anexo pode ser upado automaticamente.
