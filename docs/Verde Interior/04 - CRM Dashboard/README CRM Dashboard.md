# CRM / Dashboard — Status Atual

**Status:** 🟡 Construído localmente — funcional, aguardando deploy
**Stack:** React 18 + JSX (Vite)
**Pasta local:** `apps/crm/`
**Deploy:** pendente (ver [[PROXIMOS-PASSOS]])

---

## O que está construído

### Navegação e estrutura
- [x] `CRMContext.jsx` — estado global com 12 leads simulados, métricas, CRUD completo
- [x] `App.jsx` — roteamento entre todas as views com React Router
- [x] `GlobalSearch` — busca global com Cmd+K
- [x] `SidebarCalendario` — painel lateral com agenda

### Views implementadas
- [x] **Dashboard** — KPIs: total de leads, valor do pipeline, recorrência mensal, taxa de conversão
- [x] **Kanban** — funil com 5 estágios, cards com badge de serviço
- [x] **Funil de Execução** — contratos ativos com 5 estágios de execução
- [x] **Agenda** — calendário de visitas e follow-ups
- [x] **Tarefas** — gestão de tarefas com CRUD e toggle de conclusão
- [x] **RoutePlanner** — roteirizador por bairro e frequência de visita
- [x] **Configurações** — configurações do sistema
- [x] **ModalOrcamento** — detalhe do lead com mudança de status

### Persistência
- [x] localStorage (`crm-verde-leads`) — funciona, mas dados se perdem ao trocar dispositivo

### Funil Kanban (5 estágios definidos)
1. Contato Recebido
2. Orçamento Pendente
3. Orçamento Enviado
4. Aprovado
5. Não Aprovado

---

## O que falta

### Prioridade alta
- [ ] **Deploy no Vercel** (Fernando) — ninguém acessa online ainda
- [ ] **Supabase** — substituir localStorage por banco real (leads, tarefas)
- [ ] **Autenticação** — login para acessar o CRM

### Funcionalidades pendentes
- [ ] Motivo obrigatório ao mover para "Não Aprovado"
- [ ] Formulário de cadastro de novo lead (UI)
- [ ] Filtros no Kanban (responsável, serviço, bairro)
- [ ] Exportação do pipeline em CSV

---

## Tipos de serviço (para badges)

| Serviço | Faturamento | Observação |
|---|---|---|
| Venda de Vasos e Plantas | Único | — |
| Manutenção de Vasos e Plantas | Recorrente | Mensal, Quinzenal ou Semanal |
| Reforma de Vasos e Plantas | Único por demanda | — |
| Locação de Vasos e Plantas | Recorrente | Manutenção inclusa |
| Locação de Vasos e Plantas para Eventos | Único | Data/hora estritas de entrega e retirada |

## Contexto técnico dos clientes

Todos os clientes da Verde Interior têm ambientes corporativos com:
- Ar condicionado ligado constantemente
- Apenas luz artificial (sem luz solar direta)
- Sem pontos de água próximos (rega manual com transporte de água)

Isso implica seleção de espécies resistentes a sombra e logística de rega planejada.
