# Reforma do Gerador de Orçamentos — Requisitos

**Entrevista concluída em 24/08/2026** (Blocos 1–11).
Fonte: entrevista com Beto Flaquer + análise do código real em `apps/crm/src/components/Orcamentos/`.

> Este documento é a fonte de verdade dos requisitos. O [[README Gerador de Orçamentos]] descreve o **estado do código**; quando os dois divergirem, o código manda.

---

## 1. Contexto e dor

A equipe (Beto, Fernando, Tatyana, Rafael, Thamires) monta todos os orçamentos **manualmente no Word**, abrindo o orçamento anterior do mesmo grupo de serviço e copiando por cima. As duas dores concretas: **caçar as fotos das plantas** e **redigitar tudo**.

**Maior ganho esperado do sistema: velocidade de resposta** — responder um orçamento em minutos, não em horas, para colocar mais propostas na rua.

---

## 2. Serviços e precificação

**7 tipos de serviço**, multi-seleção no mesmo orçamento:
`venda` · `reforma` · `locacao` · `manut-rec` · `manut-pont` · `eventos` · `outros`

Regras firmadas:
- **Locação** ativa manutenção automaticamente e trava o card (manutenção é inclusa) — já implementado.
- **Evento ≠ Locação**: evento tem data e hora estritas de entrega e retirada.
- Reforma é serviço de primeira classe, existe sozinho.

**Preço:** tabela padrão, ajustável por cliente. O desconto já vem embutido no preço final — **não mostrar "de/por"** no documento.

**Manutenção** varia por: quantidade de vasos · com/sem reposição de plantas (e limite mensal) · localização favorável (mesmo prédio = desconto) · quantidade de visitas mensais.

**Eventos** têm cobranças extras: estacionamento (calculado pelo local, ex. SP Expo R$ 75/h) e trabalho noturno (1 funcionário R$ 150, 2 = R$ 300).

> ⚠️ **Decisão 24/08:** estacionamento e trabalho noturno **devem somar no total**, como linha em "Custos adicionais". Hoje são apenas texto decorativo no documento — o cliente lê o valor mas ele não entra na conta.

**Múltiplas opções concorrentes** (Opção 1 / Opção 2, cliente escolhe **uma**, valores **não somam**) são **necessárias** — acontecem nos orçamentos reais em Word. Hoje o gerador só tem seções que somam.

---

## 3. Clientes (Bloco 6)

| Tema | Decisão |
|---|---|
| Dados no documento | Acrescentar apenas **"A/C" (Aos cuidados de)**. CNPJ e endereço completo **não** são necessários. |
| Vínculo | **Os dois caminhos**: orçamento pode nascer de um **lead** ou de um **cliente já existente**. Hoje só existe `lead_id`. |
| Preço por cliente | **Não** reaplicar automaticamente. Basta **ver o histórico** de por quanto aquele item foi vendido àquele cliente. |
| Histórico na ficha | **Sim** — listar os orçamentos do cliente dentro da tela de Clientes, com status e valor. |

---

## 4. Documento e PDF (Blocos 7 e 8)

| Tema | Decisão |
|---|---|
| Saída do PDF | **Download direto** do arquivo, A4, nome padronizado. Sem diálogo de impressão do navegador. |
| Nome do arquivo | `DDMM.AA Orçamento de <serviço> - <Empresa>` (já é o padrão gerado por `gerarNome()`). |
| Catálogo anexo | **Anexo manual, fora do sistema.** Não construir seleção de páginas de catálogo. |
| Versionamento | **Sobrescrever.** Renegociação edita o mesmo orçamento; não guardar v1/v2. |
| Layout | **Redesenhar estilo apresentação** — foto em destaque, preço unitário + total, menos cara de planilha. Aproximar dos orçamentos reais. |
| Texto "Incluso no orçamento…" | **Editável no próprio orçamento**, caso a caso. Hoje está chumbado no código. |
| Dados de pagamento | **Só a modalidade** (Boleto / Pix). Chave Pix e dados bancários **não** vão no orçamento. |
| Assinaturas | **Remover do documento.** Orçamento é proposta, não contrato. |
| Número `ORC-NNN` | **Aparece no documento**, no cabeçalho. |

### Envio

Hoje é manual. **O ideal é enviar automaticamente ao finalizar**, por **e-mail e WhatsApp** — os dois botões na tela de envio, escolhendo na hora conforme o cliente.

- E-mail: PDF anexado, registro de data e destinatário. Exige serviço de e-mail configurado (ex. Resend) — é a parte mais custosa.
- WhatsApp: mensagem pronta para o contato; o PDF ainda é anexado à mão.

---

## 5. Reuso, histórico e dados (Bloco 9)

| Tema | Decisão |
|---|---|
| Matar a dor nº 1 | **Modelos salvos.** Orçamentos-modelo por tipo de serviço (ex. "Manutenção escritório padrão") a partir dos quais se começa um novo. |
| Exclusão | **Apagar de vez, com confirmação** — comportamento atual mantido. Sem lixeira. |
| Relatórios | **Os três**: conversão por tipo de serviço · desempenho por consultor · valor por período. |

---

## 6. Usuários e permissões (Bloco 10)

| Tema | Decisão |
|---|---|
| Visibilidade | **Todos veem e editam todos** os orçamentos. Equipe pequena, mantém aberto. |
| Catálogo e templates | **Todos editam.** Agilidade compensa o risco. |
| Auditoria | **Histórico de alterações** — registrar mudanças relevantes (preço alterado, status mudado), com quem e quando. Hoje só existe `criado_por` como texto solto. |

> O RLS atual (`USING (true)` para qualquer autenticado) **já atende** às duas primeiras decisões. Não há trabalho de permissão a fazer; o que falta é a trilha de auditoria.

---

## 7. Futuro (Bloco 11)

| Tema | Decisão |
|---|---|
| Aprovação digital (link + aceite) | **Talvez depois.** Não é o gargalo. Backlog de longo prazo. |
| Ao aprovar, gerar automaticamente | **Ordem de Serviço** — já com itens, endereço e data. |
| Reserva no estoque | **Plano futuro**, não agora. |
| Contrato automático | Não pedido. |

---

## 8. Catálogo — pendências de conteúdo

- Catálogo Escritório (51 págs) e Eventos (29 págs) em `tools/orcamentos/orcamentos-temp/catalogos/`.
- **Pág. 24 do Catálogo Eventos (Painel Verde / muro verde): REMOVER** — serviço descontinuado.
- Fotos em `C:\Users\betof\OneDrive - VERDE INTERIOR PAISAGISMO LIMITADA\Menu Verde Interior\Fotos Orçamentos` (~1.734 arquivos).
- Triagem pendente dos `DSC_XXXX.png` em `Vasos/Polietileno/` — a maioria são duplicatas do mesmo modelo. Renomear e manter um por modelo antes de subir ao catálogo.
- Tipos de vaso: Polietileno Médio/Grande/Floreira (5 cores) e Vasos de Madeira.
- Espécies especiais têm custo separado (ex. orquídeas = reposição a cada 4 semanas).

---

## 9. Backlog priorizado

### 🔴 Corrigir antes de qualquer feature
1. ~~**Bloco de imagem não salva, em silêncio.**~~ ✅ Corrigido em 24/08 — migration `047` libera `tipo='imagem'` e o INSERT do item passou a checar erro.
2. ~~**Manutenção recorrente cobrada como valor único.**~~ ✅ Corrigido em 24/08 — a proposta principal ganhou seletor de categoria, com default coerente com os tipos marcados.

### 🟠 Alto valor
3. **Estacionamento e trabalho noturno somando no total** (decisão §2).
4. **Múltiplas opções concorrentes** — Opção 1 / Opção 2 onde o cliente escolhe uma (§2).
5. **Redesenhar o preview em estilo apresentação** (§4) — o gap mais citado.
6. **Download direto do PDF** em vez do diálogo de impressão (§4).
7. **Modelos salvos** de orçamento (§5) — resposta direta à dor nº 1.
8. **`numero_opcao`/`ordem` colidem** entre a proposta principal e a primeira seção adicional (`novaOpcao(prev.length + 1)`), embaralhando a ordem das seções entre sessões.

### 🟡 Médio
9. Vincular orçamento a **cliente existente**, não só a lead (§3).
10. **Histórico de orçamentos na ficha do cliente** (§3).
11. Campo **"A/C"** no documento (§3).
12. Texto "Incluso no orçamento…" **editável** no orçamento (§4).
13. **Remover bloco de assinaturas** do documento (§4).
14. **Histórico de alterações** / auditoria (§6).
15. **Relatórios**: conversão por tipo, por consultor, valor por período (§5).
16. **Gerar OS ao aprovar** o orçamento (§7).
17. Off-by-one na sequência: `setval(seq, GREATEST(max_num,1))` na migration 046 faz o primeiro número virar `ORC-002` — `ORC-001` nunca é emitido.
18. `orcamento_templates_servico` **sem RLS** — única tabela do módulo sem, e o front escreve nela.
19. Descrições padrão **triplicadas** sem fonte única: `orcamento-templates.js`, `TemplatesOrcamento.jsx` e o seed da migration 045.

### ⚪ Higiene
20. 2 erros de ESLint em `Orcamentos.jsx` (`sessionStorage` fora dos globals) — o lint do CRM está quebrado.
21. `supabase/.temp/` e `tools/schema-prod.sql` deveriam ser gitignorados (`schema-prod.sql` é o stderr de um `supabase db dump` que falhou, não um dump).
22. `apps/crm/src/components/ModalSelecionarEndereco/` está órfão, sem nenhum import.
23. Catálogo incompleto: o seed só cria `tipo='planta'`/`categoria='escritorio'` e deixa preço e ficha técnica em NULL, embora o CatalogoModal filtre por vaso/extra e eventos/geral. Falta CRUD de catálogo na UI.

### Fora de escopo (decidido)
- Páginas de catálogo anexadas pelo sistema — anexo manual.
- Versionamento v1/v2 — sobrescrever.
- Lixeira / arquivamento — apagar de vez.
- CNPJ e endereço completo no documento.
- Chave Pix e dados bancários no documento.
- Preço por cliente reaplicado automaticamente.
- Permissões por consultor — todos veem e editam tudo.
- Aprovação digital com link de aceite — longo prazo.
- Reserva de estoque na aprovação — longo prazo.
