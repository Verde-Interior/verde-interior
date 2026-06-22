# Padrões Comuns — Verde Interior

> Referência técnica e visual para todos os módulos. Todo novo desenvolvimento deve seguir estes padrões para garantir consistência na futura unificação.
> Última atualização: junho 2026

---

## Paleta de cores

### Cores principais (extraídas dos módulos existentes)

| Nome | Hex | Uso |
|---|---|---|
| Verde escuro | `#1a3d22` | Cabeçalhos, botões primários, nav |
| Verde médio | `#2d6a35` | Acentos, hover |
| Verde claro | `#4a8c52` | Ícones secundários |
| Verde bg | `#EAF3DE` | Fundos de cards, badges de sucesso |
| Vermelho vinho | `#7a1f1f` | Ação destrutiva, alertas críticos |
| Vermelho bg | `#fef2f2` | Fundo de alertas |
| Cinza quente | `#f5f4f0` | Fundo da página |
| Cinza texto | `#374151` | Texto principal |
| Cinza suave | `#6b7280` | Texto secundário |
| Borda | `#e5e7eb` | Bordas de cards e inputs |
| Branco | `#ffffff` | Superfícies de cards |

### Cores de status

| Status | Fundo | Texto | Borda | Uso |
|---|---|---|---|---|
| Concluído | `#EAF3DE` | `#27500A` | `#97C459` | OS concluída, ponto registrado |
| Em andamento | `#FAEEDA` | `#633806` | `#EF9F27` | Serviço em execução |
| Atenção | `#FCEBEB` | `#791F1F` | `#F09595` | Banco crítico, atraso |
| Pendente | bg-secondary | texto-secondary | borda-tertiary | Aguardando ação |

---

## Tipografia

**Fontes em uso:**
- `Inter` — corpo de texto, UI geral (Google Fonts)
- `Montserrat` — títulos, cabeçalhos de documentos (Google Fonts)
- `-apple-system, BlinkMacSystemFont, 'Segoe UI'` — fallback (usado no Ponto)

**Tamanhos:**

| Uso | Tamanho | Peso |
|---|---|---|
| Título de módulo / documento | 22px | 700–800 |
| Título de seção | 16px | 600–700 |
| Subtítulo / label uppercase | 10–12px | 600–700 + letter-spacing |
| Corpo de texto | 13–14px | 400 |
| Texto secundário / meta | 11–12px | 400 |

---

## Espaçamento

Múltiplos de 8px:

| Uso | Valor |
|---|---|
| Espaço interno de componente pequeno | 8px |
| Gap entre itens em lista | 8–12px |
| Padding interno de card | 16–20px |
| Entre seções | 24–32px |
| Entre blocos maiores | 48px |

---

## Componentes

### Botão primário
```css
background: #1a3d22;
color: white;
border: none;
padding: 9px 22px;
border-radius: 6px;
font-size: 13px;
font-weight: 700;
cursor: pointer;
```

### Botão secundário
```css
background: transparent;
color: #1a3d22;
border: 1.5px solid #1a3d22;
padding: 9px 22px;
border-radius: 6px;
font-size: 13px;
font-weight: 600;
```

### Botão destrutivo
```css
background: #fef2f2;
color: #7a1f1f;
border: 1px solid #fca5a5;
padding: 9px 22px;
border-radius: 6px;
font-size: 13px;
```

### Card padrão
```css
background: #ffffff;
border: 1px solid #e5e7eb;
border-radius: 8px;
padding: 16px 20px;
```

### Badge de status
```css
display: inline-block;
font-size: 9–11px;
font-weight: 600;
letter-spacing: 0.08em;
text-transform: uppercase;
padding: 3–4px 8–10px;
border-radius: 3–4px;
/* cores conforme tabela de status acima */
```

### Input de formulário
```css
width: 100%;
border: 1px solid #e5e7eb;
border-radius: 5px;
padding: 7px 10px;
font-size: 13px;
outline: none;
/* focus: border-color: #2d6a35 */
```

---

## Ícones

- **Ponto:** Font Awesome 6.5 (CDN)
- **OS e Orçamentos:** emojis inline (provisório)
- **CRM / futuro:** Tabler Icons (outline) — padrão recomendado para unificação

Ao unificar, padronizar todos para **Tabler Icons outline**.

---

## IDs e estrutura de dados

### Formato de IDs

| Entidade | Formato | Exemplo |
|---|---|---|
| Cliente | `CLI-NNN` | `CLI-001` |
| Orçamento | `ORC-NNN` | `ORC-042` |
| Ordem de Serviço | `OS-NNN` | `OS-042` |
| Funcionário | nome lowercase | `brenno` (já em uso no Ponto) |

IDs são gerados sequencialmente e usados para vincular registros entre módulos. A busca de clientes e orçamentos é sempre feita pelo nome — o ID é referência interna.

### Nomes dos funcionários (padrão já em uso no Ponto)

`Beto`, `Brenno`, `Bruno`, `Carlos`, `Greg`, `Miriam`, `Pedro Silva`, `Peterson`

Usar exatamente estes nomes em todos os módulos para garantir compatibilidade na unificação.

### Status do orçamento

| Status | Significado | Ação gatilho |
|---|---|---|
| Rascunho | Em elaboração | — |
| Enviado | Aguardando resposta | — |
| Aprovado | Cliente aceitou | **Gera OS automaticamente** ← gatilho confirmado |
| Não aprovado | Cliente recusou | Registrar motivo |
| Cancelado | Descartado | — |

---

## Regras de negócio compartilhadas

### Reposição de plantas (Orçamentos)
- Locação de Vasos e Plantas ativa → reposição sempre "ilimitada", campo travado
- Outros modelos → toggle: quantidade específica ou ilimitado

### Modelos que ativam Manutenção de Vasos e Plantas automaticamente
- Locação de Vasos e Plantas → auto-ativa Manutenção de Vasos e Plantas + torna Fidelidade obrigatória

### Banco de horas (Ponto)
```
meta mensal = jornada 8h → 176h | jornada 6h → 132h | outros → jornada × 22
saldo do dia = minutos trabalhados − (jornada × 60)
```

### Fluxo de ponto (ordem obrigatória)
`entry → break → return → exit`
Não alterar esta sequência sem discussão.

---

## O que NÃO mudar sem discussão

- Paleta de cores (definida a partir do logo da empresa)
- Nomes dos funcionários (usados como chaves no banco)
- Lógica de banco de horas (`calcWork`, `calcWorkClosed`)
- Credenciais Supabase (não rotacionar sem atualizar Vercel)
- Estrutura de navegação do Ponto (Colaborador / Gestor / Configurações)
