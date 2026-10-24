# HortAi

HortAi helps primary-school children with homework and test preparation through thinking prompts, graduated hints and comprehension questions. The child brings a school task or chooses a teacher-written assignment; HortAi never solves it and offers no exercises or gamification of its own.

Before planning features, read the [product vision](docs/product/vision.md) and the [concept overview with Mermaid diagrams](docs/product/flows.md). They distinguish agreed requirements from proposals and undecided technical details; a diagram or gallery does not prove implementation.

A [Next.js](https://nextjs.org) App Router application with TypeScript, PostgreSQL ([Prisma](https://www.prisma.io)) and [Better Auth](https://www.better-auth.com). Production runs on Vercel.

Before changing code, read [`AI_RULES.md`](AI_RULES.md), [`docs/rules/`](docs/rules/README.md) and [`docs/conventions/`](docs/conventions/README.md).

## Prerequisites

- Node.js 24 (`nvm use` reads `.nvmrc`)
- Docker with Compose v2

## Quick start

```bash
cp .env.example .env                # app settings, ready for local development
cp .env.docker.example .env.docker  # settings of the local containers
npm ci
docker compose --env-file .env.docker config   # optional: validate the interpolation
docker compose --env-file .env.docker up -d --wait
npm run db:generate
npm run db:migrate
npm run dev                         # http://localhost:3000
```

`npm run db:seed` loads sample data (seed modules are `prisma/seed/<name>.seed.ts`).

## Local infrastructure

The application runs on your machine. Docker Compose runs only its local dependencies; app and migration containers are intentionally not part of this stack. Each service stands in for the real one, so local code takes the same path as production (`docker-compose.yml`, project `hortai`).

| Service        | Stands in for                 | Address                                              | App settings (`.env`)                       |
| -------------- | ----------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `postgres`     | PostgreSQL                    | `localhost:5432` (databases `hortai`, `hortai_auth`) | `DATABASE_URL`, `AUTH_DATABASE_URL`         |
| `redis-rest`   | Upstash Redis (rate limiting) | `http://localhost:8079` (backed by `redis`)          | `UPSTASH_REDIS_REST_URL`, `_TOKEN`          |
| `mailpit`      | SMTP provider                 | SMTP `localhost:1025`, inbox `http://localhost:8025` | `MAIL_PROVIDER=smtp`                        |
| `azurite`      | Azure Blob Storage            | `http://localhost:10000/devstoreaccount1`            | `STORAGE_PROVIDER=azure`, `STORAGE_AZURE_*` |
| `azurite-init` | (one-off) creates containers  | -                                                    | `STORAGE_AZURE_*_CONTAINER`                 |

- Ports are bound to `127.0.0.1` only.
- Mailpit inbox: <http://localhost:8025>; Redis REST: <http://localhost:8079>; Azurite Blob: <http://localhost:10000>.
- The root `.env` configures the app running on the host, so it uses `localhost` endpoints. `.env.docker` configures the containers and Compose interpolation; always pass it with `--env-file .env.docker`. Keep the values both files share identical (database user, password and names; `SRH_TOKEN` = `UPSTASH_REDIS_REST_TOKEN`; the Azurite account, key and container names; `DOCKER_APP_ORIGIN` = `NEXT_PUBLIC_APP_URL`). The comments in both templates name the counterpart.
- Stop the services with `docker compose --env-file .env.docker down`; add `-v` to also delete the local database and blob data, only when you mean to.
- Never commit `.env` or `.env.docker`. They hold local development values, not production configuration; production values live in your deployment platform's secret store (Vercel and GitHub secrets).

## Environment variables

- `.env.example` documents every application variable, in numbered sections. Variables are validated at startup; a bad or missing value stops the app and names the variable.
- Rate limiting always uses the Upstash store (no in-memory mode; unit tests use a double that lives only under `__tests__`). For development it can be switched off with `RATE_LIMIT_ENABLED=false`, like authentication with `AUTH_ENABLED=false`; production refuses both. Production requires `https` for Upstash, the storage endpoint and the public storage URL.
- Add a variable with `npm run gen -- env <NAME>` ([guide](docs/conventions/adding-an-environment-variable.md)).
- Integration tests read the same variables (`.env` locally, the job environment in CI) and skip a service that is not configured.

## Commands

| Command                           | What it does                                                         |
| --------------------------------- | -------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Development server, production build, production server              |
| `npm run check`                   | Everything CI runs: types, lint, format, i18n, dead code, all tests  |
| `npm test`                        | Unit tests (`npm run test:watch` while developing)                   |
| `npm run test:integration`        | Integration tests; need the containers and a migrated database       |
| `npm run lint:fix` / `format`     | Fix lint and formatting                                              |
| `npm run dead-code`               | Fail on an export nothing references ([guide](scripts/README.md))    |
| `npm run db:migrate`              | Apply app and auth migrations                                        |
| `npm run db:generate`             | Emit the Prisma contract; commit the result                          |
| `npm run gen -- <generator>`      | Scaffold modules, use cases, components, translations, env variables |

Run the narrowest tests while iterating and `npm run check` before opening a pull request.

## Continuous integration

- Pull requests: lint, types, database contract and migrations, tests, license check, security scan, build. The `CI success` job is the single required check.
- `main`: re-runs CI, builds, migrates both databases, deploys to Vercel and smoke-tests `/api/health`.
- CI starts the emulators (`redis-rest`, `azurite`, `azurite-init`) from `docker-compose.yml` with the values of `.env.docker.example`, next to a Postgres service. Actions are pinned to commit SHAs; Dependabot keeps them and the container images current.

## Project layout

```
src/
  app/            routes, layouts, route handlers: framework entry points only
  modules/        business capabilities, one folder per module (see below)
  lib/            shared infrastructure, one folder per part, imported as @lib/<part>
  components/     shared UI: ui/ (shadcn), layout/, shared/ composites, providers/
  hooks/          shared client hooks
  i18n/           locale plumbing: config, formatters, locales, messages/{en,de}.json
  types/          ambient type declarations
prisma/           schema, migrations and seed
migrations/auth/  authentication migrations (applied by npm run db:migrate:auth)
docker/           init scripts for the local containers
eslint/           repository-specific lint rules
scripts/          code generators (npm run gen) and maintenance scripts
docs/             product/, rules/, conventions/, architecture/, agents/, design-system/
public/           static assets
__tests__/        tests mirroring src/, plus architecture/, eslint/ and scripts/
```

`src/modules/`, `src/hooks/` and the `ui/`, `layout/` and `shared/` folders of `src/components/` are created when the first module, hook or component needs them; do not add empty folders.

A module is `src/modules/<name>/` with `domain/` (models, errors, ports), `application/` (commands, queries, services), `infrastructure/` (adapters), `presentation/` (actions, components), `composition.ts` (the only place use cases meet adapters), `index.ts` (server API) and `client.ts` (browser-safe API). Scaffold one with `npm run gen -- module <name> --fields "<fields>"` ([guide](docs/conventions/adding-a-module.md)).

`src/lib` parts: `actions`, `clock`, `config`, `db`, `errors`, `fonts`, `logger`, `mail`, `pagination`, `rate-limit`, `result`, `security`, `seo`, `storage`, `utils`. What each is for: [`src/lib/README.md`](src/lib/README.md). Dependencies point inward and modules talk to each other only through public APIs: [`docs/rules/boundaries.md`](docs/rules/boundaries.md).
