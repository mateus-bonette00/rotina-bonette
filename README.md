# Rotina Bonette

Aplicação pessoal, local, de uma pessoa só. Organiza o dia, os projetos, as ideias e o foco sem virar um gerenciador corporativo.

## Requisitos

- Node.js 20 ou mais novo
- npm 10
- Docker com Docker Compose

## 1. Instalar dependências

Na pasta do projeto:

```bash
npm install
```

## 2. Configurar o ambiente

```bash
cp .env.example .env
```

O `.env.example` já funciona nesta máquina, com o Postgres só em `127.0.0.1`. Troque `POSTGRES_PASSWORD` e `SESSION_SECRET` se mais alguém usar o computador. O arquivo `.env` não entra no Git.

## 3. Subir o PostgreSQL 16

```bash
npm run db:up
```

O banco escuta apenas em `127.0.0.1:5432`. Para parar:

```bash
npm run db:down
```

## 4. Criar as tabelas

```bash
npm run db:migrate
```

Na primeira vez o Prisma pede um nome da migração. Use `init`.

## 5. Criar o PIN

Existe um único usuário. Não há cadastro.

```bash
npm run setup
```

O terminal pede um PIN de 4 números e não mostra o que você digita. Ele grava só o hash Argon2id.

Sem terminal interativo:

```bash
INITIAL_PIN=1234 npm run setup
```

Apague `INITIAL_PIN` do ambiente depois. O PIN puro não fica no `.env`, no banco nem nos logs.

Rodar o setup de novo troca o PIN do mesmo usuário.

## 6. Carregar os projetos iniciais

```bash
npm run db:seed
```

Entram OdontoClin, Landing Page Janaina, Junta Já, Pró-Saúde, Ponte Viva e Clineline, com as tarefas e rotinas da especificação. Rodar de novo não duplica.

## 7. Iniciar

```bash
npm run dev:all
```

Sobe o Postgres (`db:up`), depois o shared, a API e o site. Equivale a `npm run db:up && npm run dev`.

```bash
npm run dev
```

Só API + site, se o banco já estiver no ar.


- Site: http://127.0.0.1:5173
- API: http://127.0.0.1:4000

A API escuta só em localhost. O site manda `/api` para ela pelo proxy do Vite, então o cookie de sessão fica no mesmo endereço.

Para subir separado:

```bash
npm run dev:api
npm run dev:web
```

## Testes

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Os testes da API usam um banco `rotina_bonette_test`, criado sozinho se o Postgres estiver no ar.

O smoke do navegador pede o PIN real da sua instalação:

```bash
npx playwright install chromium
E2E_PIN=1234 npm run test:e2e
```

Troque `1234` pelo PIN que você criou.

## Backup

Em Ajustes:

- Exportar JSON baixa tudo, menos o PIN.
- Importar JSON valida o arquivo, grava uma cópia em `data/backups/` e só então substitui os dados.
- Apagar dados exige digitar `APAGAR TUDO`. O usuário e o PIN continuam.

## Segurança

- PIN de 4 números, hash Argon2id, nunca em texto puro.
- Sessão no PostgreSQL, cookie HttpOnly e SameSite=Strict.
- CSRF nas alterações.
- No máximo 5 PINs errados em 15 minutos. A mensagem é sempre a mesma.
- Helmet, limite de corpo e de requisições, CORS só para o site local.
- Sem cadastro, sem recuperar PIN por e-mail e sem JWT no navegador.

Para abrir em outro aparelho, use uma VPN (Tailscale ou WireGuard) com HTTPS. Não publique a porta da API no roteador.

O contador de PIN errado fica na memória da API. Reiniciar a API zera esse contador. O limite geral de requisições também.

## Decisões da v1

- CSRF por token de sessão no header `x-csrf-token`. A biblioteca `csurf` está abandonada.
- Ideia convertida em projeto nasce estacionada, para não furar o limite de 4 ativos.
- Afazeres não têm teto: várias tarefas podem ficar em Fazendo e em Hoje. O painel ainda sugere até 3 para o dia.
- "Desbloqueia outra atividade" soma ponto quando existe outra tarefa bloqueada no mesmo projeto ativo.
- Pausar o foco é local. O servidor guarda o começo, o fim e os minutos informados ao encerrar.
- Apagar projeto arquiva. Apagar tarefa remove de verdade.
- OdontoClin ficou como trabalho ativo. A manutenção recorrente ficou com Pró-Saúde.
- Prazos e o bloco de calendário do seed são ponto de partida para o dia aparecer preenchido.

## O que não entrou

Multiusuário, cadastro, OAuth, Google Calendar, app nativo, push, IA, gamificação e microserviços.
