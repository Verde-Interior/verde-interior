# Ordem de Serviço — Status Atual

**Arquivos:**
- `tools/ordem de servico/plano-execucao-heimr_10.html` — original standalone (mantido, agora **dinâmico**, apesar do nome legado com "heimr")
- `apps/crm/public/os.html` — cópia servida pelo Vite (idêntica). Os dois DEVEM ficar em sync.

**Stack:** HTML único, offline, sem dependências externas (QR usa API pública `api.qrserver.com`)
**Status:** ✅ Modo Execução/Conclusão dinâmico implementado (20/07/2026, sprint 3-C)
**Última atualização da doc:** 20/07/2026

> Observação: para operações **em campo com colaboradores**, o Sistema de Campo do App Ponto (Minha Agenda → check-in → fotos → assinatura → checkout) continua sendo o fluxo principal. Esta OS HTML complementa como link/QR compartilhável e como documentação de entrega ao cliente.

---

## O que funciona agora (após sprint 3-C)

### Parametrização por URL (removido o hardcode Heimr)

Query string aceita:
- `?cliente=` nome do cliente
- `?os=` id/número da OS (aparece no cabeçalho)
- `?endereco=`, `?bairro=`, `?contato=`, `?telefone=`
- `?plantas=` — formato compacto `Nome:Local:Obs|Nome2:Local2:Obs2` **ou** JSON URL-encoded
- `?modo=` `execucao` ou `conclusao` (default: `execucao`)

Se abrir sem query string, mostra tela "Selecione uma OS" com input para colar URL.

### Modo Execução / Modo Conclusão (Opção B — decisão 22/jun)

- **Execução (default):** só slot "Antes" liberado. "Depois" trancado com cadeado. FAB "✓ Finalizar Execução → Ir para Conclusão" só habilita quando **todas** as plantas têm foto Antes (se faltar, alerta lista quais).
- **Conclusão:** "Antes" trancado, "Depois" liberado. Botão "Voltar p/ Execução" alterna. Ao concluir todas as fotos "Depois", tela de resumo com "Imprimir" e "Exportar JSON".

Regra extra: remover uma foto "Antes" também remove a "Depois" correspondente (coerente — Depois sem Antes não faz sentido).

### Persistência

- `localStorage['verde-os-<os_id>']` — armazena `{ modo, plantas: [{id, antesUrl, depoisUrl, obsAntes, obsDepois}] }`.
- Fotos comprimidas via canvas para WebP (~100KB alvo, max 1600px, qualidade decrescente até caber).
- Restaura ao reabrir a mesma OS.

### Link / QR

- Botão "🔗 Copiar link" no cabeçalho.
- Botão "📱 QR" abre modal com QR gerado via `api.qrserver.com` (fallback simples — se depois quiser embutir a lib qrcode-generator, trocar em um lugar só).

### Mobile-first

- Grid 2 colunas para "Antes/Depois" quando ambas existem.
- `capture="environment"` no input file (câmera traseira em mobile).
- FAB fixo no rodapé.

---

## Como usar (exemplo)

```
/os.html?cliente=Huawei&os=OS-042&endereco=Av+Faria+Lima+123&bairro=Vila+Olimpia&contato=Maria&telefone=11987654321&plantas=Ficus:Sala:podar|Zamioculca:Recepcao:limpar&modo=execucao
```

Depois de finalizar Execução, muda pra `&modo=conclusao` (o próprio botão faz isso).

---

## Pendências futuras

- Integrar geração do link com o CRM: no modal do funil de execução ("orientação/nota fiscal"), adicionar botão "🔗 Gerar link da OS" que monta a URL a partir do lead aprovado.
- Sinalizar de volta ao CRM quando a OS for concluída (postMessage ou hitting endpoint).
- Avaliar migrar para módulo React dentro do CRM na Plataforma Unificada (só após refactor do EscalaCampo e ModalOrcamento).

Ver [[decisoes-pendentes]] e [[PROXIMOS-PASSOS]].
