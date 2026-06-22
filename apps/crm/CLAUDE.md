# CRM - Verde Interior Paisagismo Corporativo

## 🌿 Escopo e Regras do Negócio
Este CRM é customizado para uma empresa de paisagismo focada em ambientes corporativos internos. 
- **Cenário Técnico Padronizado:** Todos os clientes possuem ambientes com ar condicionado ligado constantemente, apenas luz artificial e sem pontos de água próximos. A equipe de campo sempre opera sabendo dessas restrições (seleção de espécies resistentes de sombra e logística de rega manual com transporte de água).
- **Canais de Entrada de Leads:** WhatsApp, E-mail e Telefone (campo obrigatório de origem).

### Serviços Oferecidos
1. **Venda de Vasos e Plantas** (Faturamento único)
2. **Manutenção de Vasos e Plantas** (Faturamento recorrente: Mensal, Quinzenal ou Semanal)
3. **Reforma de Vasos e Plantas** (Faturamento único por demanda)
4. **Locação de Vasos e Plantas** (Faturamento recorrente com manutenção inclusa)
5. **Locação de Vasos e Plantas para Eventos** (Faturamento único com data/hora estritas de entrega e retirada)

### Funil de Vendas (Etapas do Projeto)
`contato_recebido` ➔ `orcamento_pendente` ➔ `orcamento_enviado` ➔ `orcamento_aprovado` ou `orcamento_nao_aprovado`

---

## 🏗️ Diretrizes de Arquitetura e Tecnologia
- **Stack:** React.js (Vite), JavaScript Moderno (ES6+), CSS Puro isolado por componente.
- **Componentização:** Abordagem funcional e isolada. Cada componente possui sua própria pasta com o arquivo `.jsx` e `.css`.
- **Estado Global:** React Context API em `src/context/CRMContext.jsx` para centralizar a lista de leads, contratos e funções de atualização.
- **Padrão de UI:** Interface limpa, organizada, focada em produtividade.

## 💻 Instrução de Output para o Claude Desktop
- Sempre que gerar um componente, forneça o código completo estruturado em blocos separados com o caminho do arquivo no topo (ex: `// src/components/LeadCard/LeadCard.jsx`), facilitando o processo de copiar e colar.
