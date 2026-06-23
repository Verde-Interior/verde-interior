# CRM / Dashboard — Status Atual

**Status:** 🔴 Em desenvolvimento — estrutura criada, sem componentes implementados
**Stack:** React 18 + JSX (Vite)
**Pasta local:** `apps/crm/`
**Deploy:** ainda não

---

## O que foi definido

**Funil Kanban (5 estágios):**
1. Contato Recebido
2. Orçamento Pendente
3. Orçamento Enviado
4. Aprovado
5. Não Aprovado (com motivo obrigatório)

**Motivos de perda (obrigatórios ao marcar "Não Aprovado"):**
- Preço Alto
- Concorrente Cobriu Oferta
- Opção por Plantas Artificiais
- Projeto Suspenso

**Campos do lead:** empresa, serviço (com badge por tipo), bairro, valor, canal de origem

---

## Backlog de componentes

### Fase 1 — Funil visível
- [ ] `CRMContext.jsx` — estado global com dados simulados e função `moverLead()`
- [ ] `LeadCard` — nome, serviço (badge), bairro, valor, canal
- [ ] `KanbanColumn` — filtra por status, mostra contador
- [ ] `KanbanBoard` — organiza 5 colunas na horizontal

### Fase 2 — Gestão comercial
- [ ] `ModalOrcamento` — detalhe do lead + mudança de status
- [ ] Trava de motivo obrigatório ao marcar "não aprovado"
- [ ] Integração com Supabase (persistência real)

### Fase 3 — Pós-venda e logística
- [ ] Campos de contrato: início, vigência, reajuste, dia de faturamento
- [ ] `RoutePlanner` — roteirizador por bairro e frequência de visita
- [ ] Botão de solicitação de reposição de planta
- [ ] `Agenda` — calendário de visitas e follow-ups

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
