# Ordem de Serviço — Status Atual

**Arquivo atual:** `tools/ordem-de-servico/plano-execucao-heimr_10.html` (1.146 linhas)
**Pasta local:** `tools/ordem-de-servico/`
**Stack:** HTML único, offline, sem dependências externas
**Status:** 🟡 Funcionando na web — dados hardcoded (Heimr) e sistema de fotos sem gating por modo
**Última atualização da doc:** 20/07/2026

> Observação: para operações **em campo com colaboradores**, o Sistema de Campo do App Ponto (Minha Agenda → check-in → fotos → assinatura → checkout) já resolve o fluxo mobile. Este HTML segue relevante para documentação impressa/entrega ao cliente.

---

## O que funciona (versão atual)

- Cabeçalho com dados do cliente e tipo de serviço
- Barra de info (data, responsável, tipo, status)
- Tabela de plantas com operações: Nova, Substituição, Preenchimento, Cortesia, Movimentação
- Lista de insumos técnicos em cards
- Roteiro de execução passo a passo com alertas críticos
- Sistema de fotos: tag de Momento (Antes/Depois) + Área (multiselect)
- Checklist de conclusão (14 itens)
- Assinatura do líder Verde Interior e responsável do cliente
- Campo de observações finais

## Situação atual

A OS existe e funciona na web. O layout mobile foi construído e aprovado visualmente. Falta tornar o acesso fluido para o colaborador usar no celular em campo.

---

## Próxima versão

**Origem dos dados:** importados do orçamento aprovado + campos editáveis para complementar

**Decisão sobre fotos:** ✅ Opção B (Modo Execução / Modo Conclusão) — 22/06/2026. Implementação ainda pendente no HTML. Ver [[decisoes-pendentes]].

**Encerramento definido:**
- Assinatura digital ou campo de nome do cliente
- Campo de observações finais do colaborador

## Pendências

- Parametrizar dados de cliente/plantas por OS (remover hardcode Heimr)
- Implementar Modo Execução (só "Antes") vs Modo Conclusão (libera "Depois")
- Gerar link/QR fixo por OS para acesso em campo
- Avaliar se essa OS deve ser migrada para módulo React dentro do CRM (Plataforma Unificada)
