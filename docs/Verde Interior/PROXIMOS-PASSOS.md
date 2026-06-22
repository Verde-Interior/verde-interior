# Verde Interior — Próximos Passos

> Documento de trabalho da equipe. Atualizar ao concluir cada item ou tomar uma decisão.
> Última atualização: junho 2026

---

## ⚠️ Decisões bloqueantes

Precisam ser tomadas antes de avançar nas integrações entre módulos.

| Decisão | Status | Referência |
|---|---|---|
| ~~Sistema de fotos da OS~~ | ✅ Opção B escolhida | [[03 - Ordem de Serviço/decisoes-pendentes]] |
| ~~Formato do ID único de cliente~~ | ✅ `CLI-NNN`, `ORC-NNN`, `OS-NNN` | [[06 - Padrões Comuns/padroes-comuns]] |
| ~~Status que dispara criação de OS~~ | ✅ `orcamento_aprovado` → cria OS | [[06 - Padrões Comuns/padroes-comuns]] |

---

## Sprint atual

### CRM — Fase 1 (Fernando)
**Meta:** Funil Kanban visível e funcional com dados simulados

- [ ] `src/context/CRMContext.jsx` — estado global com dados simulados, função `moverLead(id, novoStatus)`
- [ ] `src/components/LeadCard/` — empresa, serviço (badge colorida), bairro, valor, canal de origem
- [ ] `src/components/KanbanColumn/` — filtrar leads por status, mostrar contador no topo
- [ ] `src/components/KanbanBoard/` — organizar 5 colunas na horizontal

**Para rodar:** `cd apps/crm && npm run dev`
**Referência:** [[04 - CRM Dashboard/README]]

---

### Orçamentos — Bugs prioritários (Roberto)
**Meta:** Eliminar os 3 bugs que afetam o uso comercial diário

- [ ] Bug 1: proposta gerada vazia sem aviso ao usuário
- [ ] Bug 2: conflito de override no título ao editar inline
- [ ] Bug 3: reset incorreto do toggle de reposição de plantas

**Arquivo:** `tools/orcamentos/verde_interior_gerador_orcamento_10.html`
**Referência:** [[01 - Orçamentos/roadmap]]

---

## Fila — próximos sprints

### OS — Adaptação mobile (aguarda decisão de fotos)
- [ ] Fernando decide Opção A ou B → [[03 - Ordem de Serviço/decisoes-pendentes]]
- [ ] Testar layout mobile no celular em campo
- [ ] Garantir acesso fluido via QR code ou link direto

### Orçamentos — Funcionalidades essenciais
- [ ] Numeração automática de propostas
- [ ] Salvamento de rascunho em localStorage
- [ ] Data de validade automática (+30 dias padrão)
- [ ] Campos de e-mail e telefone do cliente
- [ ] Botão "limpar tudo"

### CRM — Fase 2
- [ ] `ModalOrcamento` — detalhe do lead + mudança de status
- [ ] Trava: motivo obrigatório ao mover para "Não Aprovado"
- [ ] Integração com Supabase (persistência real)

### Ponto Eletrônico — Melhorias pendentes
- [ ] Reset de senha via e-mail (UI faltando)
- [ ] Gestor redefine senha de colaborador
- [ ] Exportação XLSX
- [ ] Relatório de frequência mensal

---

## Pré-requisitos para a unificação

Antes de conectar os módulos num hub central:

- [ ] ID único de cliente definido e implementado em **todos** os módulos
- [ ] Nomes de funcionários padronizados em todos os módulos
- [ ] Gatilho orçamento aprovado → cria OS (implementado)
- [ ] Design system visual aplicado em todos os módulos

Ver: [[05 - Plataforma Unificada/README]]

---

## Como trabalhar juntos

### Setup local

**CRM** (Fernando)
```
cd apps/crm
npm install
npm run dev     # http://localhost:5173
```

**Ponto Eletrônico** (referência / leitura)
```
cd apps/ponto
npm install
npm run dev
```

**OS e Orçamentos** (Roberto)
Abrir diretamente no navegador — sem build, sem instalação.

---

### Convenção de branches

```
main                        ← código em produção (não commitar direto)
dev                         ← integração antes de ir para main
feature/crm-fase1
feature/orcamentos-bugs
fix/os-mobile
```

Fluxo: cria branch → desenvolve → abre PR para `dev` → testa → merge em `main`.

---

### Regras que não mudar sem discussão

- Credenciais Supabase — se rotacionar, atualizar também no Vercel
- Nomes dos funcionários — são chaves no banco do Ponto
- Fluxo de ponto: `entry → break → return → exit`
- Paleta de cores — deriva do logo da empresa

Decisões novas? Registrar em [[00 - Visão Geral/decisoes-importantes]].
Design system? Atualizar [[06 - Padrões Comuns/padroes-comuns]].
