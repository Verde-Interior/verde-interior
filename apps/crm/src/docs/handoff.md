# CRM Verde Interior - Estado do Projeto (Handoff)

## 🔄 Status Atual do Desenvolvimento
O projeto foi estruturado conceitualmente dentro do Claude Desktop Project. O ambiente de pastas local na máquina do usuário já foi mapeado, mas nenhum código de componente foi gerado ainda.

## 🎯 Backlog de Execução (Roteiro de Desenvolvimento)

### Fase 1: Base de Dados e Core Visível (O Funil)
- [ ] **Tarefa 1.1:** Criar o `CRMContext.jsx` em `src/context/`. Deve conter o estado global dos leads com dados simulados cobrindo os 5 tipos de serviços, o canal de origem e o bairro (ex: Faria Lima, Vila Olímpia, Centro). Incluir a função `moverLead(id, novoStatus)`.
- [ ] **Tarefa 1.2:** Criar o componente `LeadCard` (`.jsx` e `.css`). Deve exibir o nome da empresa, o serviço (com badges coloridas por tipo), o bairro, o valor e o canal de origem.
- [ ] **Tarefa 1.3:** Criar o componente `KanbanColumn`. Deve filtrar os leads pelo status e exibir o contador de cards no topo da coluna.
- [ ] **Tarefa 1.4:** Criar o componente `KanbanBoard` organizando as 5 colunas do funil de vendas na horizontal.

### Fase 2: Gestão Comercial e Bloqueios de Negócio
- [ ] **Tarefa 2.1:** Criar o componente `ModalOrcamento`. Ao clicar em um `LeadCard`, abre este modal para detalhar: dados do cliente, descrição aberta do orçamento e alteração de status.
- [ ] **Tarefa 2.2 [Crítica]:** Implementar a trava de segurança no `ModalOrcamento`. Se o usuário alterar o status para `orcamento_nao_aprovado`, um campo do tipo Select chamado "Motivo da Perda" deve se tornar obrigatório (Opções: Preço Alto, Concorrente Cobriu Oferta, Opção por Plantas Artificiais, Projeto Suspenso).

### Fase 3: Pós-Venda, Recorrência e Logística
- [ ] **Tarefa 3.1:** Adicionar campos de controle de contrato no contexto para leads aprovados: Data de Início, Vigência (em meses), Índice de Reajuste Anual e Dia de Faturamento Técnico.
- [ ] **Tarefa 3.2:** Criar o componente `RoutePlanner` (Roteirizador de Visitas). Uma tela gerencial que lê os clientes ativos (Locação e Manutenção) e permite filtrá-los e agrupá-los por **Bairro** e **Frequência de Visita** (Semanal/Quinzenal/Mensal) para desenhar a escala de trabalho dos técnicos de campo.
- [ ] **Tarefa 3.3:** Criar o botão de "Solicitar Reposição de Planta" na ficha do cliente para gerar relatórios de plantas que precisam ser substituídas na próxima visita devido à depreciação gerada pelo ar condicionado.
