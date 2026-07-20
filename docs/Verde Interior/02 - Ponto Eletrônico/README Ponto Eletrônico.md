# Ponto Eletrônico — Status Atual

**Status:** ✅ Produção
**URL:** https://verde-interior-pwa.vercel.app
**Repositório:** https://github.com/Verde-Interior/verde-interior (pasta `apps/ponto/`)
**Pasta local:** `apps/ponto/`
**Stack:** Vite + JavaScript ES Modules + Supabase
**Última atualização da doc:** 20/07/2026

---

## Equipe cadastrada

| Nome        | Cargo      | Contrato | Jornada | Usuário    |
| ----------- | ---------- | -------- | ------- | ---------- |
| Beto        | Vendas     | CLT      | 8h      | `beto`     |
| Brenno      | Consultor  | PJ       | 6h      | `brenno`   |
| Bruno       | Designer   | CLT      | 8h      | `bruno`    |
| Carlos      | TI         | CLT      | 8h      | `carlos`   |
| Greg        | Estagiário | CLT      | 8h      | `greg`     |
| Miriam      | RH         | CLT      | 8h      | `miriam`   |
| Pedro Silva | Financeiro | CLT      | 8h      | `pedro`    |
| Peterson    | Arquiteto  | CLT      | 8h      | `peterson` |
| Fernando    | Gestor     | —        | —       | `fernando` |

---

## O que funciona (colaborador)

**Ponto e horas:**
- Bater ponto: entrada, intervalo, retorno, saída
- Geolocalização (alta precisão, 20s timeout) na entrada e saída
- Relógio ao vivo com data por extenso
- Espelho mensal com impressão
- Banco de horas: saldo, extras, devidas, histórico semanal
- Justificativas com upload de até 5 anexos (PDF, DOC, IMG com preview)
- Notificações browser de lembrete (08h05 entrada, 18h05 saída)
- Troca de senha

**Minha Agenda / Sistema de Campo (Fase 3 completa):**
- Lista de visitas do dia (data navegável)
- Detalhe da visita: cliente, endereço, contato, contrato
- Check-in com GPS → execução com timer + observações
- **Fotos:** compressão WebP (1024px, ~40-80KB), fallback JPEG, legendas por foto
- **Assinatura digital:** canvas fullscreen, dataURL persistido, zoom bloqueado, modo read-only após finalizar
- **Upload resiliente:** fila em localStorage (até 20 fotos), retry manual, sobrevive a reload
- **Persistência da execução (etapa B):** localStorage 12h TTL — permite retomar visita mesmo após reload
- Relatório final: campo de relato + legendas auto-geradas
- Submit final: checkout com GPS + timestamp → atualiza `ultima_visita` no cliente

---

## O que funciona (gestor)

- Dashboard com 4 KPIs (presença, ausência, intervalo, atrasos)
- Tabela de status em tempo real
- Alertas automáticos (banco crítico ≤ -120min, devidas ≥ 4h)
- Edição de registros em qualquer data (só gestor pode deletar, com warning)
- Aprovação/recusa de justificativas com visualização de anexos
- Adicionar / editar / remover colaboradores
- Exportação CSV
- Relatórios: tabela com dias, horas, meta, extras, devidas, saldo + gráfico de barras
- Filtro de equipe por dropdown; se gestor tem `employee_id`, vê sua própria Minha Agenda

---

## Arquitetura resumida

```
Frontend: HTML + CSS + JS ES Modules (vanilla — sem React)
Build:    Vite
Backend:  Supabase (PostgreSQL + Auth + Storage + Edge Functions)
Auth:     email {username}@vi.app + senha
Deploy:   Vercel (auto via GitHub push)
PWA:      Service Worker com auto-update
```

## Módulos JS principais (`src/`)

- `main.js` — bootstrap
- `nav.js` — navegação entre views/subviews
- `punch.js` — registro de ponto + geoloc
- `agenda.js` — Sistema de Campo completo (~1.500 linhas)
- `bank.js` / `mirror.js` — banco de horas e espelho
- `auth.js`, `admin.js`, `config.js`, `justs.js`, `upload.js`
- `store.js` — estado global + operações DB
- `notify.js`, `pwa.js`, `utils.js`, `supabase.js`

## Banco de dados

- `employees` — dados e métricas da equipe
- `profiles` — vínculo auth.user ↔ employee + role
- `punch_records` — registros de ponto com lat/lng
- `justifications` — ocorrências com anexos
- `agenda` — visitas agendadas
- `relatorios` — relatórios de visita com checkin/checkout
- `fotos_relatorio` — fotos e assinaturas de visita

**Storage:** bucket `field-photos` (fotos WebP + assinaturas PNG), signed URLs 7-30 dias.

## Service Worker

- Cache-first para assets estáticos
- Network-first + fallback para chamadas Supabase
- Auto-update com banner "Nova versão"
- Nunca cacheia `/rest/`, `/auth/`, `/storage/` (fix `e462576`)

---

## Bugs / riscos conhecidos

- **Perfil do colaborador não implementado** (`renderProfile()` placeholder)
- **Sem escape de texto livre** — XSS potencial em campos de observação
- **Geo sem retry:** timeout de 20s, se falhar o ponto bate sem coordenadas
- **Zoom bloqueado no viewport** (`user-scalable=no`) — acessibilidade
- **Alguns `.then()` sem `.catch()`** em `auth.js`, `agenda.js` (uploads e removePhoto)
- **Sem auditoria** — nenhum log de quem editou o quê
- **RLS não é verificável no cliente** — confiança total no Supabase

---

## Próximos passos

- [ ] Reset de senha via e-mail (UI faltando)
- [ ] Gestor redefine senha de colaborador
- [ ] Exportação XLSX (adicionar SheetJS)
- [ ] Relatório de frequência mensal (faltas / atrasos)
- [ ] Gráfico de evolução do banco de horas (Chart.js sobre `buildWeeks()`)
- [ ] Auditoria: `audit_log` em `punch_records` e `justifications`
- [ ] Implementar view de Perfil
- [ ] Escapar campos de texto livre
- [ ] Configurar Vitest + primeiros testes de `calcWork` / `calcWorkClosed`

## Não mudar sem discussão

- Paleta: verde `#2d5a1b` + vermelho `#7a1a1a`
- Fluxo de ponto: `entry → break → return → exit`
- Lógica `calcWork` / `calcWorkClosed`
- Credenciais Supabase
- Nomes dos usuários (`beto`, `brenno`, `bruno`, `carlos`, `greg`, `miriam`, `pedro`, `peterson`, `fernando`) — são chaves no banco
