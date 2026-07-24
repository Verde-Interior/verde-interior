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
**Motivo:** até então leads e tarefas viviam só em `localStorage`; perda de dados ao trocar de dispositivo ou limpar cache.
**Impacto:** ver [[schema-supabase]] (novas tabelas + coluna JSONB `dados` para estado aninhado). Migration `015_crm_leads_tarefas.sql`.

### RPC atômica `reorder_agenda`
**Data:** 20/07/2026
**Decisão:** Substituir todos os `Promise.all([...UPDATE...])` da `EscalaCampo.jsx` por uma RPC PL/pgSQL `reorder_agenda(p_updates jsonb)` que roda os UPDATEs numa única transação.
**Motivo:** dois usuários mexendo em drag & drop / otimizador de rota ao mesmo tempo podiam deixar `ordem_rota` inconsistente.
**Impacto:** funções afetadas: `moverSelecionadasPara`, `moverVisita`, `aplicarOrdemRota`, `aplicar` (redistribuição de ausentes). Migration `015`.

### Roles no CRM adiados
**Data:** 20/07/2026
**Decisão:** Não criar hierarquia de roles no CRM por ora. RLS mantém padrão `_auth_all` (só authenticated).
**Motivo:** hoje só gestores usam o CRM. Colaboradores de campo usam o App Ponto.
**Reavaliar quando:** algum colaborador de campo precisar entrar no CRM.

### Multi-tipo de serviço no lead
**Data:** 20/07/2026
**Decisão:** Trocar `leads.tipo_servico TEXT` por `leads.tipos_servico TEXT[]` (migration 016). Nas leituras usar helper `getTiposServico(lead)` do CRMContext. Coluna antiga `tipo_servico` mantida como deprecated.
**Motivo:** a empresa vende combinações reais como "reforma + manutenção" e "locação + manutenção". Modelo singular distorcia badges, filtros e criação de contratos.
**Impacto:** cards do Kanban mostram 1 badge por tipo; `promoverParaCliente` cria N contratos (um por tipo).

### Auditoria de edições no Ponto via trigger genérico
**Data:** 20/07/2026
**Decisão:** Uma única tabela `public.audit_log` alimentada por trigger genérico `audit_trigger()` (`SECURITY DEFINER`), anexado em `punch_records` e `justifications` (migration 017). Log é imutável.
**Motivo:** gestor pode adicionar/apagar batidas e aprovar/recusar justificativas — sem log, zero rastreabilidade.
**Impacto:** Para adicionar auditoria em outra tabela: `CREATE TRIGGER foo_audit AFTER INSERT OR UPDATE OR DELETE ON foo FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()`.

### Agenda vinculada a lead OU cliente
**Data:** 20/07/2026
**Decisão:** Tornar `agenda.cliente_id` nullable + adicionar `agenda.lead_id UUID FK leads(id) ON DELETE CASCADE` + CHECK `agenda_cliente_xor_lead`. Migration 016.
**Motivo:** antes gestor precisava criar cliente "rascunho" só pra publicar visita técnica de prospecção — poluía a base.
**Impacto:** EscalaCampo faz join com `leads` também; cartão da Escala ganha badge "🌱 lead".

---

### Estoque v2: event sourcing + patrimônios físicos individuais
**Data:** 23/07/2026
**Decisão:** Reescrever o esquema de estoque de plantas para event sourcing com patrimônios físicos individuais (migrations 025-028). Cada planta física recebe um QR code VI-xxxx permanente. O status e espécie da planta são derivados do histórico de eventos em `estoque_eventos`. Insumos/vasos/materiais permanecem no modelo simples (saldo por item).
**Motivo:** plantas são ativos físicos com identidade própria (podem ser trocadas de espécie, mandadas pra manutenção, transferidas entre clientes). Modelo de saldo simples perdia esse histórico. Event sourcing permite rastrear toda a vida útil de cada planta.
**Impacto:** migrations 025 (schema), 026 (37 espécies + 260 patrimônios), 027 (migração do legado), 028 (especie_id nullable). Views antigas `estoque_saldos_totais` e `estoque_saldos_por_titular` dropadas.

### QR patrimônio: identidade física permanente da planta
**Data:** 23/07/2026
**Decisão:** O `qr_codigo` (VI-xxxx) de um patrimônio é **imutável após criação** — é a identidade física da etiqueta física. A espécie atribuída ao QR pode mudar (registra evento `troca_especie`). Scan mobile via `?patrimonio=VI-xxxx` na URL abre `ModalAtribuirQR` sem precisar de login separado.
**Motivo:** etiqueta física é impressa e colada na planta/vaso — não pode mudar. A espécie na etiqueta sim (planta pode ser trocada no mesmo vaso).
**Impacto:** regra adicionada em PROXIMOS-PASSOS.md como "não mudar sem discussão".

### Estoque — abas Plantas vs QR Codes separadas
**Data:** 23/07/2026
**Decisão:** Aba Plantas mostra espécies do catálogo com quantidades agregadas (derivadas de `estoque_especies_resumo`). Aba QR Codes gerencia os patrimônios físicos individuais (VI-xxxx). São abas separadas no mesmo módulo Estoque.
**Motivo:** usuário queria ver "Dracena compacta: 12 disponíveis" sem precisar entender o conceito de patrimônio. A gestão individual de QR codes é operação de campo, não visão de estoque.
**Impacto:** `PlantasTab` usa `estoque_especies_resumo`. `QRTab` usa `estoque_patrimonios_view`.

### Supabase CLI como único canal para migrations
**Data:** 23/07/2026
**Decisão:** Todas as migrations futuras devem ser criadas em `apps/ponto/supabase/migrations/` e aplicadas via `supabase db push`. Nunca mais rodar SQL direto no Supabase Dashboard.
**Motivo:** migrations 001-024 tinham sido aplicadas manualmente via SQL Editor — o CLI não rastreava nenhuma delas. Para resolver, rodamos `supabase migration repair --status applied` para cada uma, estabelecendo o CLI como autoridade. Sem o CLI, é impossível saber quais migrations foram aplicadas.
**Impacto:** a partir de 025, todas as migrations têm tracking correto no CLI. Setup documentado em PROXIMOS-PASSOS.md e arquitetura-geral.md.
