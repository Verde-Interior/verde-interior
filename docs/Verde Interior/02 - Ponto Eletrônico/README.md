# Ponto Eletrônico — Status Atual

**Status:** ✅ Produção
**URL:** https://verde-interior-pwa.vercel.app
**Repositório:** https://github.com/Verde-Interior/verde-interior (pasta `apps/ponto/`)
**Pasta local:** `apps/ponto/`
**Stack:** Vite + JavaScript ES Modules + Supabase
**Banco:** Supabase — projeto `verde-interior-ponto`

---

## Equipe cadastrada

| Nome | Cargo | Contrato | Jornada | Usuário |
|---|---|---|---|---|
| Beto | Vendas | CLT | 8h | `beto` |
| Brenno | Consultor | PJ | 6h | `brenno` |
| Bruno | Designer | CLT | 8h | `bruno` |
| Carlos | TI | CLT | 8h | `carlos` |
| Greg | Estagiário | CLT | 8h | `greg` |
| Miriam | RH | CLT | 8h | `miriam` |
| Pedro Silva | Financeiro | CLT | 8h | `pedro` |
| Peterson | Arquiteto | CLT | 8h | `peterson` |
| Fernando | Gestor | — | — | `fernando` |

---

## O que funciona (colaborador)

- Bater ponto: entrada, intervalo, retorno, saída
- Geolocalização na entrada e saída
- Relógio ao vivo com data por extenso
- Espelho mensal com impressão
- Banco de horas: saldo, extras, devidas
- Justificativas com upload de anexos
- Notificações browser de lembrete
- Troca de senha

## O que funciona (gestor)

- Dashboard com 4 KPIs
- Tabela de status em tempo real
- Alertas automáticos (banco crítico, atraso)
- Edição de registros em qualquer data
- Mapa Leaflet com pins de entrada/saída
- Aprovação de justificativas
- Exportação CSV
- Adicionar/editar/remover colaboradores

---

## Arquitetura resumida

```
Frontend: HTML + CSS + JS ES Modules
Build:    Vite
Backend:  Supabase (PostgreSQL + Auth + Storage + Edge Functions)
Auth:     email {username}@vi.app + senha
Deploy:   Vercel (auto via GitHub push)
```

## Banco de dados (4 tabelas)

- `employees` — dados e métricas da equipe
- `profiles` — vínculo auth.user ↔ employee + role
- `punch_records` — registros de ponto com lat/lng
- `justifications` — ocorrências com anexos

---

## Próximos passos

- [ ] Reset de senha via e-mail (UI faltando)
- [ ] Gestor redefine senha de colaborador
- [ ] Exportação XLSX com SheetJS
- [ ] Relatório de frequência (faltas/atrasos por mês)
- [ ] Gráfico de evolução do banco de horas
- [ ] Auditoria: log de edições

## Não mudar sem discussão

- Paleta: verde `#2d5a1b` + vermelho `#7a1a1a`
- Fluxo de ponto: `entry → break → return → exit`
- Lógica `calcWork` / `calcWorkClosed`
- Credenciais Supabase
