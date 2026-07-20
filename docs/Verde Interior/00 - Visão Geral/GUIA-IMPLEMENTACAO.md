# Guia de Implementação — Verde Interior
> Documento auto-suficiente para retomar o trabalho em uma nova sessão.
> Estado base: 20/07/2026 — migrations 015, 016 e 017 aplicadas.

---

## Contexto técnico (leia antes de qualquer coisa)

**Repositório local:** `c:\Users\betof\verdeinterior\verde-interior-app`
**Branch:** `master` — push vai para Vercel automaticamente

### Estrutura de pastas

```
verde-interior-app/
├── apps/
│   ├── ponto/          ← PWA vanilla JS (Vite + Supabase) — produção
│   └── crm/            ← React 18 (Vite) — produção
├── tools/
│   ├── orcamentos/     ← HTML único, sem build
│   └── ordem de servico/ ← HTML único, sem build
└── docs/
    └── Verde Interior/ ← Obsidian docs
```

### Stack resumida

| App | Build | Backend | Deploy |
|-----|-------|---------|--------|
| Ponto (`apps/ponto/`) | `npm run dev` / `npm run build` | Supabase | Vercel auto |
| CRM (`apps/crm/`) | `npm run dev` / `npm run build` | Supabase (mesmo projeto) | Vercel auto |

**Supabase:** um único projeto compartilhado entre Ponto e CRM.
**Migrations:** todas em `apps/ponto/supabase/migrations/NNN_*.sql` (mesmo sendo tabelas do CRM — compartilham o banco).

### Padrões críticos a não quebrar

- **CRMContext.jsx:** estado global do CRM. Qualquer novo estado de lead passa por `CRMContext.jsx`. Helper `getTiposServico(lead)` aceita array novo ou string legada — sempre usar esse helper.
- **EscalaCampo:** reordenação de visitas usa RPC atômica `reorder_agenda(p_updates jsonb)` — nunca substituir por múltiplos updates paralelos.
- **Dois arquivos idênticos:** `tools/orcamentos/verde_interior_gerador_orcamento_10.html` ↔ `apps/crm/public/gerador-orcamento.html`. Idem para OS. Sempre copiar entre os dois após alterar um.
- **ESLint no CRM:** rodar `npm run lint` antes e depois de cada fase. Não deixar novos erros.
- **Testes:** `npm test` em `apps/crm/` e `apps/ponto/` — devem passar sempre (24 testes no total: 13 CRM + 11 Ponto).
- **Vercel auto-deploy:** qualquer push para `master` faz deploy de ambos os apps. Não fazer push com build quebrado.

### Como rodar localmente

```bash
# CRM
cd apps/crm && npm install && npm run dev  # http://localhost:5173

# Ponto
cd apps/ponto && npm install && npm run dev

# Lint + testes (CRM)
cd apps/crm && npm run lint && npm test

# Lint + testes (Ponto)
cd apps/ponto && npm test
```

---

## O que já está feito (não refazer)

- [x] Migrations 015, 016, 017 aplicadas no Supabase
- [x] CRM: leads e tarefas persistidos no Supabase (não mais localStorage puro)
- [x] CRM: multi-tipo de serviço (`leads.tipos_servico TEXT[]`)
- [x] CRM: agenda vinculada a lead sem precisar de cliente (`agenda.lead_id`)
- [x] CRM: badge "🌱 lead" na EscalaCampo para visitas sem cliente cadastrado
- [x] CRM: deletar lead (botão no LeadCard e no ModalOrcamento)
- [x] CRM: botão "🛠 Gerar orçamento" no ModalOrcamento (abre gerador em nova aba)
- [x] CRM: multi-tipo no AddLeadModal e ModalOrcamento (checkboxes)
- [x] CRM: follow-up com separação visual ação vs lembrete (borda verde vs cinza)
- [x] CRM: Estoque etapa 2 (ModalMaterial, ModalMovimento funcionais)
- [x] CRM: ESLint 9 flat config configurado (`eslint.config.js`)
- [x] CRM: Vitest com 13 testes (`CRMContext.test.js`)
- [x] Ponto: XLSX export (SheetJS)
- [x] Ponto: relatório de frequência mensal
- [x] Ponto: gráfico de banco de horas (SVG inline)
- [x] Ponto: auditoria automática (trigger em `punch_records` e `justifications`)
- [x] Ponto: XSS escape via `esc()` em todos os innerHTML sensíveis
- [x] Ponto: Vitest com 11 testes (`utils.test.js`)
- [x] Gerador de orçamentos: 3 bugs corrigidos + 6 features (ORC-NNN, rascunho, validade, email, desconto, limpar)
- [x] OS HTML: dinâmico via query string + modo Execução/Conclusão (Opção B)

---

## FASE 1 — Tech debt rápido (sem risco, sem infra externa)

### 1.1 Corrigir o 1 erro + 15 warnings do ESLint no CRM

**Tempo estimado:** 30–45 min
**Risco:** zero — só remoção de variáveis e imports não usados
**Verificação:** `cd apps/crm && npm run lint` deve terminar com `0 problems`

Rodar `npm run lint` para ver a lista atual. Os problemas conhecidos em 20/07/2026 são:

#### `Agenda.jsx` (linha 7)
`formatarDataCurta` é importada/definida mas nunca usada.
→ Remover a declaração/import.

#### `Dashboard.jsx` (linha 2)
`useCallback` importado do React mas não usado.
→ Remover `useCallback` do import destrutivo.

#### `Dashboard.jsx` (linha ~1116)
Variável `hj` recebe valor mas não é usada nas linhas seguintes.
→ Remover a linha ou a variável. Se for `const hj = new Date()`, apagar a linha.

#### `EscalaCampo.jsx` (linha 2)
`useRef` importado mas não usado.
→ Remover do import.

#### `EscalaCampo.jsx` (linha 11)
`DIA_ID_MAP` definida mas nunca lida.
→ Renomear para `_DIA_ID_MAP` (prefixo `_` silencia a regra) ou apagar se definitivamente não será usada.

#### `EscalaCampo.jsx` (linha ~283)
Parâmetro `opts` de uma função nunca usado dentro dela.
→ Renomear o parâmetro para `_opts`.

#### `EscalaCampo.jsx` (linha ~309) — **este é o único erro (não warning)**
`no-useless-assignment`: variável recebe valor que não é usado depois.
→ Ler o contexto (`apps/crm/src/components/EscalaCampo/EscalaCampo.jsx`, linha 309) e remover ou consolidar a atribuição desnecessária.

#### `EscalaCampo.jsx` (linha ~379)
`posMel` atribuída mas não usada.
→ Renomear para `_posMel` ou remover se não for um placeholder intencional.

#### `EscalaCampo.jsx` (linha ~1955)
Parâmetro `clientes` de uma função callback nunca usado.
→ Renomear para `_clientes`.

#### `Estoque.jsx` (linha 41)
`toast` recebe valor mas não é usado.
→ Remover a linha. (Provavelmente sobra de quando o toast era manual — hoje o estado `toast` do pai já cuida disso.)

#### `KanbanBoard.jsx` (linha 50)
`useMemo` com dependência `getTiposServico` ausente do array.
→ `getTiposServico` é uma função estável do contexto; adicionar `// eslint-disable-next-line react-hooks/exhaustive-deps` na linha antes, com comentário: `// getTiposServico é estável — definida fora do render do contexto`.

#### `ModalOrcamento.jsx` (linha ~287)
`header` atribuída mas não usada.
→ Ler o contexto e remover a atribuição. Provavelmente foi desestruturada de um objeto mas acabou não sendo lida.

#### `Relatorios.jsx` (linha 95)
`useEffect` com `carregar` ausente no array de deps.
→ Verificar se `carregar` é estável (definida com `useCallback`) ou se precisa estar no array. Se for inline, mover a definição para dentro do useEffect. Se for intencional, `// eslint-disable-next-line react-hooks/exhaustive-deps`.

#### `SidebarCalendario.jsx` (linha 7)
`formatarDataLonga` importada/definida mas nunca usada.
→ Remover.

#### `SidebarCalendario.jsx` (linha 41)
`useMemo` com `hoje` ausente no array de deps.
→ Verificar: se `hoje` muda todo render, mover para dentro do memo. Se for constante, suprimir com `// eslint-disable-next-line`.

#### `Tarefas.jsx` (linha 59)
`TIPOS_SERVICO` desestruturado do contexto mas nunca lido no componente.
→ Remover da linha de destructuring.

**Após cada arquivo corrigido:** rodar `npm run lint` para confirmar que o número de problemas caiu. Ao final: `npm run build` para garantir que nada quebrou.

---

### 1.2 Exportação CSV real em Configurações

**Tempo estimado:** 15 min
**Arquivo:** `apps/crm/src/components/Configuracoes/Configuracoes.jsx`
**Linha atual:** ~126–135

**Problema:** `exportarDados()` atual gera JSON com extensão `.json`. O botão diz "Exportar dados" mas deveria gerar CSV dos leads.

**O que fazer:**

Substituir a função `exportarDados()` por duas funções e dois botões:

```js
// 1. Manter exportação JSON (útil para backup completo)
function exportarJSON() {
  const dados = { exportadoEm: new Date().toISOString(), versao: '1.0', leads, tarefas };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `crm-verde-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 2. Nova exportação CSV de leads
function exportarCSV() {
  const cols = ['ID','Empresa','Contato','Canal','Estágio','Tipos de Serviço','Valor','Bairro','Criado Em'];
  const rows = leads.map(l => [
    l.id,
    l.empresa ?? '',
    l.contato ?? '',
    l.canal ?? '',
    l.estagioId ?? '',
    (l.tiposServico ?? []).join('; '),
    l.valorEstimado ?? '',
    l.bairro ?? '',
    l.criadoEm ? new Date(l.criadoEm).toLocaleDateString('pt-BR') : '',
  ]);

  const csv = [cols, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); // BOM para Excel
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `crm-leads-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

No JSX, substituir o botão único por dois botões lado a lado:
```jsx
<button className="config__btn config__btn--secondary" onClick={exportarCSV}>
  Exportar leads CSV
</button>
<button className="config__btn" onClick={exportarJSON}>
  Backup JSON
</button>
```

**Verificar:** abrir CSV no Excel/Sheets — acentos corretos (BOM garante UTF-8 no Excel), uma linha por lead.

---

## FASE 2 — Integração CRM → OS

### 2.1 Botão "🔗 Gerar link da OS" no Funil de Execução

**Tempo estimado:** 1–2h
**Arquivo principal:** `apps/crm/src/components/FunilExecucao/FunilExecucao.jsx`
**CSS:** `apps/crm/src/components/FunilExecucao/FunilExecucao.css`

**O que fazer:** adicionar um botão no card do Funil de Execução (em cada lead) que gera e copia (ou abre) a URL da OS com dados do cliente pré-preenchidos.

**Lógica da URL da OS:**
```
/os.html?cliente=EMPRESA&os=OS-ID&bairro=BAIRRO&contato=CONTATO&telefone=TELEFONE&plantas=&modo=execucao
```

Notas importantes:
- `os=` usa o `lead.id` (UUID) ou um ID gerado. Recomendado: `OS-${lead.id.slice(0,8).toUpperCase()}`
- `plantas=` fica vazio por padrão — colaborador preenche direto na OS. Alternativa futura: modal de pre-fill de plantas.
- A URL base em dev é `/os.html`; em produção também é `/os.html` (o Vite serve `apps/crm/public/os.html`).

**Implementação passo a passo:**

1. **Adicionar função `gerarLinkOS(lead)` antes do `return`:**

```js
function gerarLinkOS(lead) {
  const params = new URLSearchParams({
    cliente:  lead.empresa ?? '',
    os:       `OS-${lead.id.slice(0, 8).toUpperCase()}`,
    bairro:   lead.bairro ?? '',
    contato:  lead.contato ?? '',
    telefone: lead.telefone ?? '',
    modo:     'execucao',
  });
  return `/os.html?${params.toString()}`;
}
```

2. **Adicionar estado para feedback do "copiado":**
```js
const [copiadoId, setCopiadoId] = useState(null);
```

3. **Adicionar função de cópia:**
```js
function copiarLinkOS(lead, e) {
  e.stopPropagation(); // não abrir o ModalOrcamento
  const url = window.location.origin + gerarLinkOS(lead);
  navigator.clipboard.writeText(url).then(() => {
    setCopiadoId(lead.id);
    setTimeout(() => setCopiadoId(null), 2000);
  });
}
```

4. **No JSX do card (após o `<footer>`), antes do bloco de MATERIAIS, adicionar:**
```jsx
<div className="funil-exec__card-os" onClick={(e) => e.stopPropagation()}>
  <button
    className="funil-exec__btn-os"
    onClick={(e) => copiarLinkOS(lead, e)}
    title="Copiar link da OS para o clipboard"
  >
    {copiadoId === lead.id ? '✅ Copiado!' : '🔗 Link OS'}
  </button>
  <a
    className="funil-exec__btn-os funil-exec__btn-os--open"
    href={gerarLinkOS(lead)}
    target="_blank"
    rel="noreferrer"
    onClick={(e) => e.stopPropagation()}
    title="Abrir OS em nova aba"
  >
    ↗
  </a>
</div>
```

5. **No CSS (`FunilExecucao.css`) adicionar:**
```css
.funil-exec__card-os {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--cream-200, #e8e0d5);
}

.funil-exec__btn-os {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border: 1px solid var(--forest-300, #7aad5e);
  border-radius: 6px;
  background: transparent;
  color: var(--forest-600, #2d5a1b);
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  transition: background 0.15s;
}

.funil-exec__btn-os:hover {
  background: var(--forest-50, #f0f7ec);
}

.funil-exec__btn-os--open {
  flex: 0 0 auto;
  padding: 4px 10px;
}
```

**Verificar:**
- Clicar em "🔗 Link OS" copia URL correta para clipboard (verificar no console ou colando em nova aba)
- Clicar em "↗" abre `/os.html` com params corretos
- Clicar nesses botões **não** abre o ModalOrcamento (stopPropagation funcionando)
- Rodar `npm run build` sem erros

---

## FASE 3 — Refactor `EscalaCampo.jsx` (arquivo com ~2.500 linhas)

**Estratégia obrigatória:** extrair **um componente por vez**, com `npm run build` passando entre cada extração. Nunca misturar refactor com mudança de comportamento.

**Arquivo atual:** `apps/crm/src/components/EscalaCampo/EscalaCampo.jsx`
**Pasta destino:** criar subpastas em `apps/crm/src/components/EscalaCampo/components/`

### Ordem de extração (do mais isolado para o mais complexo)

#### Passo 3.1 — Extrair `EscalaCartao`
O cartão de visita individual (o `<article>` ou `<div>` que representa uma visita no grid).

- Localizar no JSX o componente de cartão de visita (buscar por `__cartao` ou `__card` no CSS, ou pela estrutura que mostra nome do cliente, horário, botões de ação).
- Criar `apps/crm/src/components/EscalaCampo/components/EscalaCartao.jsx`
- Props necessárias: `visita`, `onEdit`, `onDelete`, `onMover`, e callbacks relevantes.
- O estado permanece em `EscalaCampo.jsx` — `EscalaCartao` é puramente presentacional.
- Importar e usar em `EscalaCampo.jsx`: `<EscalaCartao visita={v} onEdit={...} />`.
- `npm run build` deve passar. `npm run lint` não deve adicionar erros.

#### Passo 3.2 — Extrair `EscalaModalEdicao`
O modal de edição de visita (form com campo de horário, duração, obs, etc.).

- Localizar o JSX do modal de edição (buscar por estado como `editandoVisita` ou `modalEdicao`).
- Criar `apps/crm/src/components/EscalaCampo/components/EscalaModalEdicao.jsx`
- Props: `visita`, `funcionarios`, `onSalvar`, `onCancelar`
- Build + lint.

#### Passo 3.3 — Extrair `EscalaRedistribuicao`
O modal/painel de redistribuição de ausentes (arrastar visitas de colaborador faltante para outros).

- Criar `apps/crm/src/components/EscalaCampo/components/EscalaRedistribuicao.jsx`
- Props: `ausentes`, `funcionarios`, `onRedistribuir`, `onFechar`
- Build + lint.

#### Passo 3.4 — Extrair `EscalaOtimizador`
A lógica e UI do otimizador de rota (reordenação por proximidade, janela de tempo).

- A função de otimização é pura (não tem side effects de UI) — extrair para `apps/crm/src/utils/otimizadorRota.js` primeiro, depois criar o componente de UI em `EscalaOtimizador.jsx`.
- Isso permite testar a função de otimização isoladamente com Vitest.

#### Passo 3.5 — Extrair `EscalaGrid`
O grid semanal em si (as colunas por dia/funcionário).

- Criar `apps/crm/src/components/EscalaCampo/components/EscalaGrid.jsx`
- Props: `semana`, `funcionarios`, `visitas`, `renderCartao`, callbacks de drag & drop.
- Ao final, `EscalaCampo.jsx` vira basicamente um orquestrador de estado + `<EscalaGrid>`.

**Após cada passo:** commit isolado com mensagem tipo `refactor(escala): extrair EscalaCartao em subcomponente`.

---

## FASE 4 — Refactor `ModalOrcamento.jsx` (arquivo com ~1.700 linhas)

**Mesma estratégia:** um componente por vez, build passando entre cada.

**Arquivo atual:** `apps/crm/src/components/ModalOrcamento/ModalOrcamento.jsx`
**Pasta destino:** `apps/crm/src/components/ModalOrcamento/sections/`

### Ordem de extração

#### Passo 4.1 — Extrair `SecaoHistorico`
O histórico de atividades do lead (a lista de events/comentários no rodapé do modal). É a seção mais isolada — não tem interação com o resto do form.

- Criar `apps/crm/src/components/ModalOrcamento/sections/SecaoHistorico.jsx`
- Props: `atividades`, `onAdicionarAtividade`
- Build + lint.

#### Passo 4.2 — Extrair `SecaoAnexos`
A seção de anexos do orçamento (upload, lista de anexos, botão "🛠 Gerar orçamento").

- Criar `SecaoAnexos.jsx`
- Props: `anexos`, `lead`, `onUpload`, `onRemover`
- Build + lint.

#### Passo 4.3 — Extrair `SecaoAgendaLead`
A seção "📅 Agendar visita técnica na Escala" (select de funcionário, data, hora, duração, obs, publicar).

- Criar `SecaoAgendaLead.jsx`
- Props: `leadId`, `funcionarios`, `agendasDoLead`, `onPublicar`, `onCancelar`
- Ela já tem estado próprio (`agendarForm`) — mover o estado para dentro dela.
- Build + lint.

#### Passo 4.4 — Extrair `SecaoFluxo`
O fluxo de orçamento (botões de aprovação, reprovação, motivo, histórico de status).

- Criar `SecaoFluxo.jsx`
- Props: `lead`, `onAprovar`, `onReprovar`, `onAvancar`
- Build + lint.

#### Passo 4.5 — Extrair `SecaoLead`
O formulário de edição dos dados do lead (empresa, contato, canal, tipos de serviço, valor, bairro).

- Criar `SecaoLead.jsx`
- Props: `lead`, `editForm`, `onChange`, `onSalvar`, `onCancelar`
- Build + lint.

Após a Fase 4, `ModalOrcamento.jsx` deve ter menos de 300 linhas — só orquestração de estado e composição das seções.

---

## FASE 5 — Infra: Reset de senha (requer configuração Supabase)

Esta fase **não pode ser feita em código sem antes configurar infra**. Ordem:

### 5.0 Pré-requisito: configurar SMTP no Supabase

1. Entrar no Supabase Dashboard → projeto → **Auth → Emails → SMTP Settings**
2. Habilitar SMTP customizado
3. Usar SMTP do Gmail ou SendGrid (não Supabase default — quota muito baixa)
4. Testar com "Send test email"

### 5.1 Migration 018 — coluna `email_recuperacao`

Criar `apps/ponto/supabase/migrations/018_email_recuperacao.sql`:
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_recuperacao TEXT;

COMMENT ON COLUMN public.profiles.email_recuperacao
  IS 'E-mail real do colaborador para recuperação de senha. Pode ser NULL se colaborador não tem e-mail próprio.';
```

Aplicar no Supabase (SQL Editor) e commitar o arquivo.

### 5.2 UI de "Esqueci minha senha" no Ponto

**Arquivo:** `apps/ponto/index.html` (tela de login) e `apps/ponto/src/auth.js`

No `auth.js`, adicionar:
```js
export async function solicitarResetSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://verde-interior-pwa.vercel.app/reset',
  });
  return error;
}
```

No HTML, adicionar link "Esqueci minha senha" abaixo do form de login. Ao clicar, pedir e-mail de recuperação e chamar `solicitarResetSenha`.

### 5.3 Rota `/reset` no Ponto

O Supabase manda link com `#access_token=...` na URL. Criar `apps/ponto/public/reset.html` (página simples com form de nova senha) que lê o token da hash e chama `supabase.auth.updateUser({ password: novaSenha })`.

### 5.4 Gestor redefine senha (Edge Function)

Só fazer se 5.0–5.3 estiverem prontos.

```bash
# Instalar Supabase CLI se não tiver
npm install -g supabase

# Criar a function
supabase functions new admin-reset-password
```

Lógica da function (`supabase/functions/admin-reset-password/index.ts`):
- Receber `{ user_id, nova_senha }` no body
- Verificar que caller é gestor (pelo JWT)
- Usar `createClient(url, SERVICE_ROLE_KEY).auth.admin.updateUserById(user_id, { password: nova_senha })`
- Retornar sucesso/erro

UI no admin do Ponto: botão "Redefinir senha" em cada linha da tabela de equipe, que abre modal com campo de nova senha e chama a Edge Function via `supabase.functions.invoke('admin-reset-password', { body: { user_id, nova_senha } })`.

---

## FASE 6 — Plataforma Unificada (futuro, não iniciar ainda)

Só iniciar quando Fases 3 e 4 estiverem completas (componentes menores = mais fácil de mover para o shell React).

### 6.1 IDs únicos (migration 019)

Sequências PostgreSQL para `CLI-NNN`, `ORC-NNN`, `OS-NNN`:
```sql
CREATE SEQUENCE IF NOT EXISTS seq_cliente_id START 1;
CREATE SEQUENCE IF NOT EXISTS seq_os_id START 1;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cli_id TEXT UNIQUE
  DEFAULT 'CLI-' || LPAD(nextval('seq_cliente_id')::TEXT, 3, '0');
```

### 6.2 Trigger: orçamento aprovado → cria OS automaticamente

Migration que cria trigger em `leads` — quando `estagio_id` muda para `orcamento_aprovado`, insere linha em nova tabela `ordens_servico` com os dados do lead.

### 6.3 Migrar Gerador de Orçamentos para React

Criar `apps/crm/src/components/GeradorOrcamento/` com a lógica atual do HTML reescrita em React. Adicionar rota `/orcamento` no `App.jsx`. Manter HTML legado em paralelo até confirmar paridade.

### 6.4 Migrar OS para React

Similar ao 6.3. Criar `apps/crm/src/components/OrdemServico/`. A maior complexidade é o canvas de fotos (WebP) e localStorage por OS — testar bem antes de remover o HTML.

---

## Checklist rápido para cada sessão

Antes de começar:
```bash
cd apps/crm && git pull && npm run lint && npm test
cd apps/ponto && npm test
```

Antes de commitar:
```bash
cd apps/crm && npm run build && npm run lint && npm test
cd apps/ponto && npm run build && npm test
```

Após commitar:
```bash
git push  # Vercel faz deploy automaticamente
```

Atualizar os docs do Obsidian em `docs/Verde Interior/` sempre que uma fase for concluída, especialmente:
- `PROXIMOS-PASSOS.md` — marcar como feito
- `README` do módulo afetado
- `arquitetura-geral.md` se houver mudança estrutural

---

## Referência de arquivos por tarefa

| Tarefa | Arquivos principais |
|--------|---------------------|
| ESLint warnings | `Agenda.jsx`, `Dashboard.jsx`, `EscalaCampo.jsx`, `Estoque.jsx`, `KanbanBoard.jsx`, `ModalOrcamento.jsx`, `Relatorios.jsx`, `SidebarCalendario.jsx`, `Tarefas.jsx` |
| CSV real | `apps/crm/src/components/Configuracoes/Configuracoes.jsx` |
| Link OS no Funil | `apps/crm/src/components/FunilExecucao/FunilExecucao.jsx` + `.css` |
| Refactor Escala | `apps/crm/src/components/EscalaCampo/EscalaCampo.jsx` → `components/Escala*.jsx` |
| Refactor Modal | `apps/crm/src/components/ModalOrcamento/ModalOrcamento.jsx` → `sections/Secao*.jsx` |
| Reset senha | `apps/ponto/src/auth.js`, `index.html`, `public/reset.html`, migration 018 |
| Migrations | `apps/ponto/supabase/migrations/` (pasta compartilhada Ponto+CRM) |
