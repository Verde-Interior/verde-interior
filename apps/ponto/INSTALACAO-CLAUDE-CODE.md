# Guia de Instalação — Claude Code
### Verde Interior · Ponto HD

> Guia direto para Windows. Duas rotas: **Terminal (Claude Code CLI)** e **Aplicativo Desktop**. Leia até o fim antes de começar.

---

## Antes de tudo — Pré-requisito obrigatório

**Claude Code exige plano pago.** O plano gratuito do Claude.ai não inclui acesso.

Planos compatíveis:
- Claude Pro — R$ ~100/mês
- Claude Max — R$ ~500/mês
- Team / Enterprise
- Console (API) — paga por uso

Se você já tem Pro ou superior, pode continuar.

---

## ROTA A — Terminal (Claude Code CLI)

Esta é a forma principal de usar o Claude Code. Você digita comandos no terminal e o Claude lê, edita e cria arquivos do seu projeto automaticamente.

---

### Passo 1 — Instalar o Claude Code no Windows

Abra o **PowerShell** (não precisa ser administrador) e rode:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Aguarde terminar. O instalador baixa e configura tudo automaticamente.

**Para confirmar que instalou:**
```powershell
claude --version
```
Deve aparecer algo como `1.x.x (claude-sonnet-4-6)`.

> **Se der erro "irm não reconhecido"** você está no CMD, não no PowerShell.
> Abra o menu Iniciar, busque "PowerShell" e abra de lá.

---

### Passo 2 — Instalar Git for Windows (recomendado)

O Git for Windows permite que o Claude Code use ferramentas Bash no Windows, o que melhora muito a experiência.

1. Acesse **git-scm.com/download/win**
2. Baixe e instale com as opções padrão
3. Feche e reabra o PowerShell após instalar

---

### Passo 3 — Autenticar com sua conta Anthropic

Na pasta do seu projeto, rode:

```powershell
claude
```

Na primeira vez, o terminal vai pedir para você autenticar. Uma janela do navegador abre automaticamente. Faça login com a mesma conta do Claude.ai que tem o plano pago.

Após login, o terminal fica pronto para usar.

---

### Passo 4 — Navegar até a pasta do projeto

```powershell
cd C:\Users\Meira\Downloads\verde-interior-pwa
claude
```

Substitua o caminho pelo local onde você extraiu o ZIP do app.

---

### Passo 5 — Primeiro uso

Com o Claude Code aberto na pasta do projeto, você já pode dar instruções em português:

```
> Leia o arquivo HANDOFF.md e me explique o que este projeto faz
```

```
> Quais arquivos existem nesta pasta?
```

```
> Inicie a Fase 1 do roadmap descrito no HANDOFF.md
```

O Claude vai ler os arquivos, entender o contexto e executar o que você pedir.

---

### Comandos úteis do terminal

| Comando | O que faz |
|---|---|
| `claude` | Abre o Claude Code na pasta atual |
| `claude --version` | Mostra a versão instalada |
| `claude doctor` | Verifica se tudo está configurado corretamente |
| `claude "sua pergunta"` | Faz uma pergunta rápida sem abrir o modo interativo |
| `Ctrl + C` | Interrompe o que o Claude está fazendo |
| `Ctrl + R` | Busca no histórico de comandos |
| `/help` | Lista os comandos disponíveis dentro do Claude Code |
| `/exit` | Sai do Claude Code |

---

## ROTA B — Aplicativo Desktop (Claude for Desktop)

Se preferir uma interface gráfica em vez do terminal, o aplicativo desktop do Claude tem uma versão integrada do Claude Code.

---

### Passo 1 — Baixar o aplicativo

Acesse **claude.ai/download** e baixe a versão para Windows.

Instale normalmente (duplo clique no `.exe`).

---

### Passo 2 — Fazer login

Abra o aplicativo e entre com sua conta Anthropic (a mesma do claude.ai com plano pago).

---

### Passo 3 — Usar o Claude Code dentro do app

No aplicativo desktop, você pode:

- Conversar com o Claude normalmente (igual ao site)
- Conectar uma pasta do seu computador para o Claude ler e editar arquivos
- Usar o **Cowork** (modo agente — disponível nos planos Max/Team/Enterprise)

Para conectar o projeto:

1. Clique no ícone de pasta ou "Adicionar projeto"
2. Selecione a pasta `verde-interior-pwa`
3. Comece a dar instruções normalmente em português

---

## Aplicativos extras recomendados

Você não precisa de todos — instale conforme avança no projeto.

### Essenciais agora

| Aplicativo | Para que serve | Download |
|---|---|---|
| **Git for Windows** | Controle de versão + habilita Bash no Claude Code | git-scm.com/download/win |
| **VS Code** | Editor de código com suporte ao Claude Code | code.visualstudio.com |

### Para o VS Code — Extensões

Abra o VS Code, vá em Extensions (`Ctrl+Shift+X`) e instale:

| Extensão | Para que serve |
|---|---|
| **Claude Code** (oficial Anthropic) | Integra o Claude Code dentro do VS Code com painel lateral |
| **Live Server** | Servidor local para testar o HTML sem terminal |
| **Prettier** | Formata o código automaticamente |
| **GitLens** | Visualiza histórico do Git dentro do editor |

### Para a próxima fase (backend)

Instale quando chegar na Fase 2 do HANDOFF.md:

| Aplicativo | Para que serve | Download |
|---|---|---|
| **Node.js 22 LTS** | Necessário para rodar servidor local e instalar pacotes | nodejs.org |
| **Supabase CLI** | Gerenciar o banco de dados do projeto | Via terminal após Node instalado |

**Para instalar Node.js via terminal (após instalar):**
```powershell
# Verificar se Node está instalado
node --version

# Deve retornar v22.x.x ou superior
```

---

## Verificação final — tudo funcionando?

Rode estes comandos em ordem. Se todos funcionarem, está pronto:

```powershell
# 1. Claude Code instalado?
claude --version

# 2. Git instalado?
git --version

# 3. Diagnóstico geral
claude doctor
```

Se `claude doctor` mostrar tudo verde, está 100% pronto.

---

## Fluxo de trabalho recomendado para o projeto

```
1. Abrir PowerShell
2. cd C:\caminho\para\verde-interior-pwa
3. claude
4. Colar o conteúdo do HANDOFF.md ou escrever:
   "Leia o HANDOFF.md e vamos iniciar a Fase 1"
5. Trabalhar em sessões de 30-60 minutos
6. Salvar com git commit ao final de cada sessão
```

---

## Problemas comuns e soluções

**"irm não é reconhecido"**
→ Você está no CMD. Abra o PowerShell.

**"claude não é reconhecido" após instalar**
→ Feche e reabra o PowerShell. O PATH precisa ser recarregado.

**Janela de autenticação não abre**
→ Verifique se o navegador padrão está funcionando. Tente `claude` novamente.

**"Plano gratuito não tem acesso"**
→ É necessário assinar o Claude Pro ou superior em claude.ai/settings.

**VS Code não vê o Claude Code**
→ Instale a extensão oficial "Claude Code" da Anthropic dentro do VS Code.

---

*Guia gerado com base na documentação oficial da Anthropic — docs.anthropic.com/en/docs/claude-code/setup*
