# Verde Interior — Próximos Passos

> Documento de trabalho da equipe. Marcar conforme concluir.
> Última atualização: junho 2026

---

## Agora — Alta prioridade

### CRM — Deploy no Vercel (Fernando)
O CRM está construído e funcionando localmente mas ninguém consegue acessar online ainda.

- [ ] Criar novo projeto no Vercel apontando para `apps/crm/` (Root Directory: `apps/crm`)
- [ ] Confirmar que o build passa sem erros
- [ ] Testar acesso pelo link gerado
- [ ] Atualizar URL do deploy em [[04 - CRM Dashboard/README]]

---

### Gerador de Orçamentos — Bugs críticos (Roberto)
Afetam o uso comercial diário. Resolver antes de qualquer nova funcionalidade.

- [ ] Bug 1: proposta gerada vazia sem aviso ao usuário
- [ ] Bug 2: conflito de override no título ao editar inline
- [ ] Bug 3: reset incorreto do toggle de reposição de plantas

**Arquivo:** `tools/orcamentos/verde_interior_gerador_orcamento_10.html`

---

## Em seguida

### CRM — Persistência real com Supabase (Fernando)
Hoje os dados ficam no `localStorage` — ao trocar de dispositivo ou limpar o cache, tudo se perde.

- [ ] Criar tabelas no Supabase: `leads`, `tarefas`
- [ ] Substituir localStorage por leitura/escrita no Supabase
- [ ] Implementar autenticação (login para acessar o CRM)
- [ ] Testar sincronização entre os dois usuários em dispositivos diferentes

---

### OS — Implementar sistema de fotos Opção B (Fernando/Roberto)
Decisão tomada: dois modos de uso.

- [ ] Modo Execução: apenas slots de "Antes" disponíveis, "Depois" bloqueados
- [ ] Modo Conclusão: slots de "Depois" liberados com "Antes" já tirados ao lado
- [ ] Testar no celular em campo com um colaborador
- [ ] Disponibilizar acesso via QR code ou link fixo na OS

---

### Gerador de Orçamentos — Funcionalidades essenciais (Roberto)

- [ ] Numeração automática de propostas
- [ ] Salvamento de rascunho em localStorage
- [ ] Data de validade automática (+30 dias padrão)
- [ ] Campos de e-mail e telefone do cliente
- [ ] Desconto global
- [ ] Botão "limpar tudo"

---

## Depois

### Ponto Eletrônico — Melhorias (Fernando)

- [ ] Reset de senha via e-mail (UI faltando)
- [ ] Gestor redefine senha de colaborador
- [ ] Exportação XLSX
- [ ] Relatório de frequência mensal (faltas/atrasos)
- [ ] Gráfico de evolução do banco de horas
- [ ] Auditoria: log de edições do gestor

---

### CRM — Funcionalidades complementares (Fernando)

- [ ] Validação de motivo obrigatório ao mover lead para "Não Aprovado"
- [ ] Formulário de cadastro de novo lead (UI)
- [ ] Filtros no Kanban (por responsável, tipo de serviço, bairro)
- [ ] Exportação do pipeline em CSV

---

### Gerador de Orçamentos — Qualidade comercial (Roberto)

- [ ] Itens de cortesia / gratuitos
- [ ] Opções A/B de proposta
- [ ] Seção de termos editável
- [ ] Reordenar itens por drag-and-drop
- [ ] Duplicar item

---

## Futuro — Integração entre módulos

Só iniciar quando os módulos individuais estiverem estáveis e em produção.

- [ ] ID único de cliente implementado em todos os módulos
- [ ] Orçamento aprovado no CRM → cria OS automaticamente
- [ ] OS vinculada ao ponto do colaborador responsável
- [ ] Dashboard financeiro com margem real por tipo de serviço

Ver: [[README Plataforma Unificada]]

---

## Setup do ambiente

**CRM** (Fernando)
```
cd apps/crm
npm install
npm run dev     ← http://localhost:5173
```

**Ponto Eletrônico**
```
cd apps/ponto
npm install
npm run dev
```

**OS e Orçamentos** — abrir o `.html` diretamente no navegador, sem instalação.

---

## Regras que não mudar sem discussão

- Credenciais Supabase — rotacionar só com todos cientes e atualizar Vercel junto
- Nomes dos funcionários — são chaves no banco do Ponto
- Fluxo de ponto: `entry → break → return → exit`
- Paleta de cores — deriva do logo da empresa

Decisões novas → registrar em [[00 - Visão Geral/decisoes-importantes]]
Design system → atualizar [[06 - Padrões Comuns/padroes-comuns]]
