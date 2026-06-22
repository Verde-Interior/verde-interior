# Plataforma Unificada — Visão Futura

> Esta é a fase final do projeto. Acontece quando os módulos individuais estiverem maduros.

---

## Conceito

Hub central com login único que conecta todos os módulos. Dados de clientes, funcionários e histórico compartilhados. O colaborador acessa tudo em um só lugar.

## Fluxo de dados automático

```
Orçamento aprovado
  → gera OS automaticamente (cliente, itens, valor preenchidos)
    → equipe registra ponto vinculado à OS
      → financeiro calcula custo de mão de obra por OS
        → margem real de cada serviço no dashboard
```

## Módulos confirmados

- Orçamentos
- Ordem de Serviço
- Ponto Eletrônico
- Financeiro / Dashboard

## Módulos futuros identificados

- CRM de clientes (em construção)
- Banco de mídias (fotos Antes/Depois centralizadas para marketing)
- Relatórios gerenciais
- Portal do cliente (visualizar OS e aprovar serviços)

## Perfis de acesso

| Perfil | Acesso |
|---|---|
| Gestor | Total |
| Colaborador | OS, Ponto, Fotos |
| Cliente (futuro) | Ver OS, aprovar |

## Arquitetura técnica planejada

- CRM (React) como shell principal
- Outros módulos migram como rotas dentro do React
- Ponto integrado via API Supabase
- HTMLs autossuficientes migram para componentes React
- Login único via Supabase Auth

## Pré-requisitos antes de unificar

- [ ] ID único de cliente definido e implementado em todos os módulos
- [ ] Nomes de funcionários padronizados em todos os módulos
- [ ] Status do orçamento como gatilho de OS funcionando
- [ ] Design system visual aplicado em todos os módulos
