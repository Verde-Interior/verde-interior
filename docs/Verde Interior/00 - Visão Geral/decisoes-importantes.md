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
