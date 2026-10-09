<!-- setup-ai-project:start -->

# Project Context

## Project

App pessoal local (um usuário) para organizar dia, projetos, ideias e foco. Monorepo npm: web + API + shared. Uso em `127.0.0.1`, autenticação por PIN de 4 dígitos.

## Stack

- Frontend: React + TypeScript + Vite (`apps/web`).
- Backend: Express + Prisma (`apps/api`).
- Shared domain: `packages/shared`.
- Database: PostgreSQL 16 via `infra/docker-compose.yml`.

## Repository Map

- `apps/web/` — UI (features, routes, components).
- `apps/api/` — HTTP API, sessão, Prisma.
- `apps/api/prisma/` — schema, migrations, seed.
- `packages/shared/` — domínio, schemas Zod, score.
- `infra/` — Docker Compose do Postgres.
- `e2e/` — Playwright.
- `PRODUCT.md` / `DESIGN.md` — produto e UI; ler só quando a tarefa tocar nisso.
- `README.md` — setup local e segurança.

## Commands

- Dev: `npm run dev`
- Test: `npm run test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- E2E: `E2E_PIN=<pin> npm run test:e2e`
- DB: `npm run db:up` / `npm run db:migrate` / `npm run db:seed`
- PIN: `npm run setup`

## Project Rules

- App single-user local: sem cadastro, sem multi-tenant, sem ERP/Notion clone.
- Limites de domínio: `DOING` ≤ 1, `TODAY` ≤ 3, projetos `ACTIVE` ≤ 4.
- Ideia nova fica na inbox até ação explícita virar projeto/tarefa.
- Regras de domínio e score ficam em `packages/shared`; API/web consomem, não duplicam.
- Bind local (`127.0.0.1`); não publicar porta da API no roteador.
- UI em português do Brasil; preservar padrões já existentes no código.

## Boundaries

- Nunca expor, logar ou commitiar PIN, `.env` ou secrets.
- Não editar migrações Prisma já aplicadas; criar migração nova quando o schema mudar.
- Não alterar `.gitignore` nem infraestrutura de produção sem pedido explícito.
- Não inventar capacidades de produto fora do pedido atual.
- Não ler `graphify-out/graph.json` diretamente.

## Navigation

- Preferir `graphify query`, `graphify path` e `graphify explain` antes de exploração ampla.
- Reusar o grafo existente; refresh só após `git commit` (hook) ou `graphify update .` sob demanda.
- Arquivos ainda não commitados: inspecionar o source direto (o grafo pode estar defasado).

## Context

- Inspecionar só arquivos relevantes à tarefa.
- Preferir busca direcionada a varredura ampla do monorepo.
- Ler `PRODUCT.md`, `DESIGN.md` ou a master spec só quando a tarefa exigir.

## Verification

- Rodar a menor validação relevante primeiro (`npm run test`, `typecheck`, `lint` ou `build`).
- Testes da API pedem Postgres (`rotina_bonette_test`); E2E pede `E2E_PIN`.
- Não reportar conclusão com falhas causadas pela mudança.

<!-- setup-ai-project:end -->
