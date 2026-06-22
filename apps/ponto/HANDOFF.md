# Verde Interior — Ponto HD · Handoff para Claude Code

> Documento atualizado em 19/06/2026.  
> Use este arquivo como contexto de entrada no Claude Code para continuar o desenvolvimento a partir do ponto exato onde paramos.

---

## 1. Visão Geral do Projeto

**Nome:** Verde Interior — Ponto HD  
**Tipo:** PWA (Progressive Web App) — Vite + JavaScript ES Modules  
**Propósito:** Sistema interno de controle de ponto e banco de horas para a equipe da Verde Interior  
**Estágio atual:** Fase 2 concluída — backend Supabase integrado, deploy em produção no Vercel  
**URL de produção:** https://verde-interior-pwa.vercel.app  
**Repositório:** https://github.com/ferworks93-weed/verde-interior-pwa

---

## 2. Arquitetura Atual

### 2.1 Stack tecnológico

```
Frontend         → HTML + CSS + JavaScript ES Modules (sem framework)
Build            → Vite
Estilo           → CSS custom properties + utility classes inline
Ícones           → Font Awesome 6.5 (CDN)
Mapas            → Leaflet.js + OpenStreetMap (gratuito, sem API key)
Backend          → Supabase (PostgreSQL + Auth + Storage + Edge Functions)
Autenticação     → Supabase Auth (JWT) com email {username}@vi.app
Persistência     → Supabase DB (primário) + localStorage (fallback offline)
PWA              → manifest.json + Service Worker (cache-first)
Exportação       → CSV via Blob URL
Deploy           → Vercel (auto-deploy via GitHub push)
```

### 2.2 Estrutura de arquivos

```
verde-interior-pwa/
├── index.html                        # Shell HTML — todas as views
├── src/
│   ├── main.js                       # Entry point — inicialização e globals
│   ├── supabase.js                   # Cliente Supabase (anon key via .env)
│   ├── auth.js                       # AUTH — login/logout/sessão via Supabase Auth
│   ├── store.js                      # Estado global + todas as funções DB (CRUD)
│   ├── punch.js                      # Bater ponto, geolocalização, renderPunch
│   ├── admin.js                      # Dashboard gestor, edição, mapa, alertas, CSV
│   ├── config.js                     # Configurações — adicionar/editar/remover colaboradores
│   ├── mirror.js                     # Espelho mensal com seletor dinâmico de mês
│   ├── bank.js                       # Banco de horas — semanas com dados reais
│   ├── justs.js                      # Justificativas + upload Supabase Storage
│   ├── upload.js                     # Drag and drop de arquivos
│   ├── notify.js                     # Notificações browser (lembrete de ponto)
│   ├── nav.js                        # Navegação entre views
│   └── utils.js                      # HM(), F(), calcWork(), TKEY, etc.
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service Worker
│   ├── icon-192.svg
│   └── icon-512.svg
├── supabase/
│   ├── schema.sql                    # Schema completo (4 tabelas + RLS + funções)
│   ├── migrations/
│   │   ├── 001_storage.sql           # Bucket justifications + coluna files
│   │   ├── 002_restrict_punch_delete.sql  # Só gestor pode deletar punch_records
│   │   └── 003_punch_location.sql    # Colunas lat/lng em punch_records
│   └── functions/
│       └── create-user/index.ts      # Edge Function — cria Auth user (service_role)
├── scripts/
│   └── seed.js                       # Seed do banco (node scripts/seed.js)
├── .env.local                        # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (git-ignored)
├── eslint.config.js
├── vite.config.js
└── package.json
```

### 2.3 Banco de dados Supabase

**Projeto:** verde-interior-ponto  
**URL:** https://mcaqxfogzvrqqnoixptv.supabase.co

#### Tabelas

```sql
employees (
  id             serial PRIMARY KEY,
  name           text NOT NULL,
  cargo          text,
  contract_type  text,          -- 'CLT' | 'PJ' | 'Estágio'
  daily_hours    numeric,       -- jornada em h/dia
  bank_minutes   integer DEFAULT 0,
  worked_hours   numeric DEFAULT 0,
  extra_hours    numeric DEFAULT 0,
  due_hours      numeric DEFAULT 0,
  days_worked    integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
)

profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users,
  employee_id    integer REFERENCES employees,
  role           text NOT NULL   -- 'gestor' | 'colab'
)

punch_records (
  id             serial PRIMARY KEY,
  employee_id    integer REFERENCES employees,
  date           text NOT NULL,  -- 'YYYY-MM-DD'
  type           text NOT NULL,  -- 'entry' | 'break' | 'return' | 'exit'
  time           text NOT NULL,  -- 'HH:MM'
  obs            text,
  lat            double precision,
  lng            double precision,
  created_at     timestamptz DEFAULT now()
)

justifications (
  id             serial PRIMARY KEY,
  employee_id    integer REFERENCES employees,
  date           text NOT NULL,
  type           text NOT NULL,
  description    text,
  status         text DEFAULT 'pendente',  -- 'pendente' | 'aprovado' | 'recusado'
  files          jsonb,
  created_at     timestamptz DEFAULT now()
)
```

#### RLS — Row Level Security

- `is_gestor()` — função security-definer: verifica se `auth.uid()` tem role='gestor' em profiles
- `my_employee_id()` — função security-definer: retorna `employee_id` do usuário autenticado
- **employees**: gestor lê/escreve tudo; colab lê só o próprio
- **punch_records**: gestor lê/escreve/deleta tudo; colab lê/insere apenas os próprios (sem delete)
- **justifications**: gestor lê/atualiza tudo; colab lê/insere apenas os próprios
- **profiles**: todos os autenticados leem; apenas gestor escreve

### 2.4 Autenticação

- Supabase Auth com email no formato `{username}@vi.app` (ex: `beto` → `beto@vi.app`)
- `AUTH.login(user, pass)` → `supabase.auth.signInWithPassword({ email: u+'@vi.app', password: p })`
- Sessão persistida via Supabase (`localStorage` interno do SDK)
- `state.cu` = índice do colaborador logado em `state.EMP[]`
- `AUTH.getSession()` retorna `{ role, employee_id, name }`

### 2.5 Variáveis de ambiente

```env
# .env.local (git-ignored) e Vercel Environment Variables
VITE_SUPABASE_URL=https://mcaqxfogzvrqqnoixptv.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_BdweK_WoG6Ecl3dgnOM_Ow_AixKmTVQ
```

> ⚠️ A service_role key (`sb_secret_ZsJcpghIzaHy_ldir1ib5A_69-BpVjU`) **nunca vai no frontend**. Só em `scripts/seed.js` e Edge Functions.

---

## 3. Equipe Atual

| Nome | Cargo | Contrato | Jornada | Usuário | Senha padrão |
|---|---|---|---|---|---|
| Beto | Vendas | CLT | 8h | `beto` | `ponto0` |
| Brenno | Consultor | PJ | 6h | `brenno` | `ponto1` |
| Bruno | Designer | CLT | 8h | `bruno` | `ponto2` |
| Carlos | TI | CLT | 8h | `carlos` | `ponto3` |
| Greg | Estagiário | CLT | 8h | `greg` | `ponto4` |
| Miriam | RH | CLT | 8h | `miriam` | `ponto5` |
| Pedro Silva | Financeiro | CLT | 8h | `pedro` | `ponto6` |
| Peterson | Arquiteto | CLT | 8h | `peterson` | `ponto7` |
| Fernando | Gestor | — | — | `fernando` | `Bebel2007` |

---

## 4. Funcionalidades Implementadas

### 4.1 Colaborador

- [x] Bater ponto — entrada, intervalo, retorno, finalizar expediente
- [x] Geolocalização na entrada e saída (non-blocking — funciona sem permissão)
- [x] Relógio ao vivo — HH:MM:SS + data por extenso
- [x] Cards do dia — entrada, horas trabalhadas, saldo (verde/vermelho)
- [x] Registros de hoje com botão de remoção (apenas gestor)
- [x] Espelho mensal com seletor dinâmico de mês (baseado em dados reais)
- [x] Impressão de espelho
- [x] Banco de horas — saldo, extras, devidas, barra visual, últimas 4 semanas com dados reais
- [x] Perfil individual — avatar, cargo, contrato, progresso da meta
- [x] Justificativa — formulário com 6 tipos de ocorrência
- [x] Upload de anexos — drag and drop, preview de imagens, salvo no Supabase Storage
- [x] Notificações browser — lembrete às 8:05 se sem entrada; às 18:05 se sem saída
- [x] Troca de senha via Supabase Auth

### 4.2 Gestor

- [x] Dashboard — 4 KPIs, tabela de status em tempo real
- [x] Progresso mensal da equipe (barras de % meta)
- [x] Alertas automáticos — banco crítico, negativo, horas devidas, entrada tardia
- [x] Edição de registros — adicionar/remover pontos em qualquer data
- [x] Mapa Leaflet com pins de entrada (verde) e saída (vermelho) + endereço via Nominatim
- [x] Aprovação de justificativas com visualização de anexos
- [x] Exportação CSV — espelho completo, resumo mensal, banco de horas
- [x] Relatório tabular mensal

### 4.3 Configurações (somente gestor)

- [x] Adicionar colaborador — cria employee no DB + chama Edge Function `create-user`
- [x] Editar colaborador — nome, cargo, contrato, jornada, banco, dias, horas (manual)
- [x] Remover colaborador
- [x] Tabela de credenciais

### 4.4 Segurança

- [x] Colaborador **não pode deletar** registros de ponto (UI + JS + RLS)
- [x] RLS no Supabase — colab acessa apenas os próprios dados
- [x] Edge Function `create-user` exige token de gestor para criar Auth users
- [x] Anon key no frontend — nunca a service_role key

### 4.5 PWA / Infraestrutura

- [x] Service Worker com cache offline
- [x] manifest.json com ícones SVG
- [x] Deploy automático: git push → GitHub → Vercel

---

## 5. Fluxo de Dados

```
Colaborador bate ponto
  → punch.js:doPunch() / doExit()
  → getCoords() — tenta geolocalização (5s timeout)
  → store.js:dbAddPunch() — INSERT em punch_records (lat/lng só se não null)
  → state.PS[idx].push(rec)
  → renderPunch()

Gestor abre Editar Registros
  → admin.js:renderEdit()
  → lista punch_records do state (já carregado no load())
  → renderPunchMap(recs) — mostra Leaflet se entry/exit tem lat/lng
  → geocode(lat, lng) — Nominatim → endereço como texto

Load inicial (ao autenticar)
  → store.js:load()
  → SELECT * FROM employees ORDER BY name
  → SELECT * FROM punch_records ORDER BY time
  → SELECT * FROM justifications ORDER BY date DESC
  → state.EMP / state.PS / state.HIST / state.JUSTS populados
```

---

## 6. Fórmulas de Negócio

```javascript
// Meta mensal de horas
meta(emp) = emp.j === 8 ? 176 : emp.j === 6 ? 132 : emp.j * 22

// Saldo do dia (ao finalizar expediente)
saldoDia = minutosTrabalhadosNoDia - (emp.j * 60)

// Acúmulo no banco
emp.bank  += saldoDia
emp.days  += 1
emp.worked = Number((emp.worked + minutosTrabalhadosNoDia / 60).toFixed(2))
if (saldoDia > 0) emp.extra += saldoDia / 60
else              emp.due   -= saldoDia / 60

// Exibição
HM(minutes) → "8h05" | "-0h30"
HMh(hours)  → "8h00"
```

---

## 7. Decisões de Design

- **Paleta:** Verde escuro `#2d5a1b` + Vermelho vinho `#7a1a1a` — do logo da marca
- **Fundo:** Cinza quente `#f5f4f0`
- **Tipografia:** `-apple-system, BlinkMacSystemFont, 'Segoe UI'` — sem fonte externa
- **Mobile-first:** viewport 100%, chips com flex-wrap
- **Mapa:** Leaflet + OpenStreetMap — gratuito, sem chave de API
- **Geocodificação reversa:** Nominatim — gratuito, sem chave de API

---

## 8. O que NÃO mudar sem discussão

- Paleta de cores (definida a partir do logo da empresa)
- Estrutura de navegação (Colaborador / Gestor / Configurações)
- Lógica de cálculo de banco de horas (`calcWork`, `calcWorkClosed`)
- Fluxo de ponto: entry → break → return → exit (nesta ordem)
- Ordenação alfabética da equipe
- Credenciais Supabase (não rotacionar sem atualizar Vercel env vars)

---

## 9. Próximos Passos Sugeridos

- [ ] Reset de senha via e-mail (Supabase Auth já suporta — falta UI)
- [ ] Gestor redefine senha de colaborador via painel
- [ ] Exportação XLSX com SheetJS
- [ ] Relatório de frequência (faltas e atrasos por colaborador/mês)
- [ ] Notificação push real (Web Push API + service worker) — atual é só browser notification
- [ ] Auditoria: log de quem editou qual registro e quando
- [ ] Gráfico de evolução do banco de horas por mês
- [ ] Rate limiting no login (Supabase Auth já tem proteção básica)

---

*Documento atualizado a partir do histórico de desenvolvimento — junho 2026.*
