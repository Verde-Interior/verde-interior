# Decisões Importantes

Log cronológico de decisões estruturais. **Nunca deletar — apenas adicionar.**

---

## Junho 2026

### Formato de IDs dos registros
**Data:** 22/06/2026
**Decisão:** `CLI-NNN` (clientes), `ORC-NNN` (orçamentos), `OS-NNN` (ordens de serviço). Sequencial por entidade, sem subdivisão por tipo de serviço.
**Motivo:** IDs são referência interna para vincular registros entre módulos — a busca sempre é feita por nome. Subdividir por tipo (ex: ORCV-, ORCR-) adicionaria complexidade sem benefício prático.

### Gatilho de criação da OS: `orcamento_aprovado`
**Data:** 22/06/2026
**Decisão:** Quando o orçamento muda para status "Aprovado" no CRM, o sistema cria a OS automaticamente com os dados do cliente, endereço, itens e valor já preenchidos.
**Motivo:** Aprovação = sinal verde total. Não há passo intermediário (contrato separado, entrada, etc.) no processo da empresa.

### Sistema de fotos da OS: Opção B
**Data:** 22/06/2026
**Decisão:** Dois modos — Modo Execução (só "Antes" disponível) e Modo Conclusão (slots de "Depois" liberados).
**Motivo:** Garante que a foto "Antes" seja registrada antes de qualquer intervenção, em 100% dos serviços. Essencial para rastreabilidade e material de marketing pareado.

---


### Estratégia: modular primeiro, unificar depois
**Data:** 22/06/2026
**Decisão:** Construir cada módulo separadamente com padrões comuns, unificar quando maduros.
**Motivo:** Escopo controlado, aprendizado incremental, erros contidos.
**Impacto:** Exige definir padrões visuais e de dados desde o início.

### Stack por tipo de módulo
**Data:** 22/06/2026
**Decisão:** HTML puro para tools simples (orçamentos, OS). React + Vite para apps com estado complexo (CRM). Supabase para apps com persistência (Ponto).
**Motivo:** Ferramentas simples não precisam de build system. Apps complexos precisam de estado e componentes.

### Não mudar sem discussão
**Data:** 22/06/2026
- Paleta de cores (deriva do logo da empresa)
- Nomes dos funcionários (chaves no banco Supabase)
- Fluxo de ponto: `entry → break → return → exit`
- Lógica de banco de horas (`calcWork`, `calcWorkClosed`)
- Credenciais Supabase (se rotacionar, atualizar também no Vercel)

---

## Julho 2026

### Leads e tarefas do CRM migrados para o Supabase
**Data:** 20/07/2026
**Decisão:** Criar tabelas `public.leads` e `public.tarefas` no Supabase e migrar `CRMContext.jsx` para ler/escrever no Supabase (com `localStorage` mantido só como cache offline). Reset dos dados de teste — não houve backfill.
**Motivo:** até então leads e tarefas viviam só em `localStorage`; perda de dados ao trocar de dispositivo ou limpar cache. Único módulo do CRM ainda sem persistência real.
**Impacto:** ver [[schema-supabase]] (novas tabelas + coluna JSONB `dados` para estado aninhado). Migration `015_crm_leads_tarefas.sql`.

### RPC atômica `reorder_agenda`
**Data:** 20/07/2026
**Decisão:** Substituir todos os `Promise.all([...UPDATE...])` da `EscalaCampo.jsx` por uma RPC PL/pgSQL `reorder_agenda(p_updates jsonb)` que roda os UPDATEs numa única transação.
**Motivo:** dois usuários mexendo em drag & drop / otimizador de rota ao mesmo tempo podiam deixar `ordem_rota` inconsistente. Não havia atomicidade entre os UPDATEs paralelos.
**Impacto:** funções afetadas: `moverSelecionadasPara`, `moverVisita`, `aplicarOrdemRota`, `aplicar` (redistribuição de ausentes). Migration `015_crm_leads_tarefas.sql`.

### Roles no CRM adiados
**Data:** 20/07/2026
**Decisão:** Não criar hierarquia de roles no CRM por ora. RLS mantém padrão `_auth_all` (só authenticated).
**Motivo:** hoje só gestores usam o CRM. Colaboradores de campo usam o App Ponto. Complexidade sem retorno imediato.
**Reavaliar quando:** algum colaborador de campo precisar entrar no CRM (ex: visualizar próprias visitas na Escala).

### Multi-tipo de serviço no lead
**Data:** 20/07/2026
**Decisão:** Trocar `leads.tipo_servico TEXT` por `leads.tipos_servico TEXT[]` (migration 016). Nas leituras usar helper `getTiposServico(lead)` do CRMContext, que aceita array novo, string legada ou vazio. Coluna antiga `tipo_servico` mantida como deprecated para não quebrar leads antigos.
**Motivo:** Roberto pediu — a empresa vende combinações reais como "reforma + manutenção" (reforma inicial e manutenção contínua) e "locação + manutenção" (locação para não perder plantas). Modelo singular distorcia badges, filtros e a criação de contratos ao promover cliente.
**Impacto:** cards do Kanban e da Escala mostram 1 badge por tipo; filtro do Kanban usa `includes`; `promoverParaCliente` cria N contratos (um por tipo recorrente/venda); "Mix de Serviços" do Dashboard conta cada tipo por lead. Alternativa "tabela relacional lead_tipos_servico" descartada por adicionar joins sem ganho.

### Agenda vinculada a lead OU cliente
**Data:** 20/07/2026
**Decisão:** Tornar `agenda.cliente_id` nullable + adicionar `agenda.lead_id UUID FK leads(id) ON DELETE CASCADE` + CHECK `agenda_cliente_xor_lead` (exatamente um dos dois preenchido). Migration 016.
**Motivo:** antes só clientes já cadastrados apareciam na Escala. Ao fazer visita técnica de prospecção (lead ainda), gestor precisava criar cliente "rascunho" só pra publicar — cria cliente-lixo e polui a base. Solução escolhida entre 3 opções.
**Impacto:** EscalaCampo faz join com `leads` também; quando a visita veio de lead, os dados de endereço/nome vêm de `leads` (via enrichment que copia pra `.clientes` no client-side); cartão da Escala ganha badge "🌱 lead". ModalOrcamento tem nova seção "📅 Agendar visita técnica na Escala" com select de funcionário + data + hora + duração.
