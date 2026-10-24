# Repository AI Instructions

This repository is **HortAi**, built with Next.js App Router, TypeScript, PostgreSQL, Prisma, and Better Auth. Read `README.md` to understand the current project purpose, architecture, setup instructions, and supported workflows. Do not infer product requirements from generic examples in these instructions.

## Required Documentation

Read and follow the relevant repository documentation before making changes.

1. `AI_RULES.md` — consolidated engineering rules.
2. `docs/rules/README.md` — engineering rules and links to individual rules.
3. `docs/conventions/README.md` — implementation conventions and task-specific guides.
4. `src/lib/README.md` — shared library utilities and their intended use.
5. `src/components/README.md` — shared component conventions and available components.
6. `docs/architecture/` — relevant architecture documentation for the subsystem being changed.
7. `eslint/README.md` — when changing ESLint configuration, custom rules, or code affected by repository-specific lint rules.

Read individual rule and convention documents when they apply to the task. Do not read every document indiscriminately when a smaller, relevant set is sufficient.

**Rules define what is allowed. Conventions describe recommended approaches for recurring tasks. Architecture documents explain subsystem-specific decisions.** If documents conflict, follow the established precedence in `docs/rules/README.md`. Resolve genuine contradictions rather than silently choosing an arbitrary interpretation.

`AI_RULES.md` is the consolidated version of the rules in `docs/rules/`. When changing a rule, update its source document and keep `AI_RULES.md` synchronized.

## Repository Structure

Use the existing repository structure and established boundaries. Confirm paths in the repository before creating new files or directories.

- `src/app/` — Next.js App Router entry points, route segments, layouts, pages, Route Handlers, and other framework-level routing concerns.
- `src/modules/<name>/` — business capabilities and their implementation layers, following the established module conventions where applicable.
- `src/lib/` — shared utilities and infrastructure intended for reuse across modules.
- `src/components/` — shared UI components.
- `src/hooks/` — shared React hooks.
- `src/i18n/` — internationalization configuration and shared i18n infrastructure.
- `prisma/` — Prisma schema, database-related code, and seed logic as defined by the existing project.
- `migrations/auth/` — authentication-related migrations.
- `eslint/` — repository-specific ESLint configuration and rules.
- `__tests__/` — automated tests, including source, architecture, ESLint, and script tests.

Use the existing path aliases defined by the repository's TypeScript configuration, including `@modules/*`, `@lib/*`, and other configured aliases. Verify the actual mappings before introducing or changing imports.

Not every module, layer, or subsystem exists in every part of the application. Do not create a module or directory merely because it appears in an example or general convention.

### Architectural Boundaries

- Keep `src/app/` focused on framework integration and request entry points. Place business logic in the appropriate application or domain layer.
- Follow the existing module boundaries and dependency direction described in `AI_RULES.md` and `docs/architecture/`.
- Reuse existing shared utilities and components instead of duplicating functionality.
- Keep infrastructure-specific implementation details behind established interfaces where the architecture calls for them.
- Avoid introducing cross-module dependencies that bypass public module APIs or established composition boundaries.
- Follow the repository's existing patterns before introducing a new abstraction, dependency, or architectural approach.

## Semantic Code Discovery

Use `jg` (`jevgrep`) for semantic code searches whenever it is available and applicable. Prefer it over broad, brute-force text searches when locating relevant symbols, implementations, call sites, or tests.

After finding a likely match:

1. Read the surrounding implementation and its callers.
2. Inspect relevant tests and related types.
3. Check existing abstractions and module boundaries.
4. Search for other usages before changing a shared API or behavior.
5. Use a narrower fallback search when `jg` is unavailable or unsuitable.

Do not assume that the first match is the only implementation or that a filename alone establishes how the code works.

## Development Commands

Use the scripts defined in `package.json`. Do not assume scripts exist unless they are listed there.

### Development and production

- `npm run dev` — start the development server.
- `npm run build` — build the application.
- `npm run start` — start the production server after building.

### Code quality and validation

- `npm run check` — run the full validation pipeline:
  - Production dependency audit (`npm run audit:prod`)
  - TypeScript type-checking
  - ESLint
  - Prettier formatting checks
  - i18n catalog tests
  - Integration tests
  - Coverage tests
  - Architecture and ESLint tests
  - Script tests
- `npm run typecheck` — run TypeScript without emitting files.
- `npm run lint` — run ESLint.
- `npm run lint:fix` — apply automatic ESLint fixes.
- `npm run format:check` — check Prettier formatting without modifying files.
- `npm run format` — format files with Prettier.

### Tests

- `npm test` — run the main test suite under `__tests__/src`.
- `npm run test:watch` — run Vitest in watch mode.
- `npm run test:integration` — run integration tests using `vitest.integration.config.ts`.
- `npm run test:coverage` — run the main test suite with coverage.
- `npm run test:architecture` — run architecture and ESLint tests.
- `npm run test:scripts` — run script tests.
- `npm run i18n:check` — validate i18n catalogs.

Run the narrowest relevant tests while iterating, then run `npm run check` before completing substantial changes when the environment permits. Report checks that could not be run and explain any failures that remain unresolved.

Do not claim a check passed unless it was actually executed and completed successfully.

### Database

- `npm run db:generate` — emit the Prisma contract.
- `npm run db:migrate:check` — check migration state.
- `npm run db:migrate:app` — apply application database migrations.
- `npm run db:migrate:status` — inspect migration status.
- `npm run db:migrate:auth` — apply authentication migrations using the repository script.
- `npm run db:migrate` — run application migrations followed by authentication migrations.
- `npm run db:verify` — verify the database in strict mode.
- `npm run db:seed` — seed the database.
- `npm run db:studio` — open Prisma Studio.

Database commands may require environment variables and a reachable database. Read the relevant migration and database documentation before changing or applying migrations.

**Treat migration, seed, and other database-mutating commands with care.** Confirm the target environment and authorization before running commands against shared or production data. Prefer inspection and validation commands when they are sufficient for the task.

### Code generation

- `npm run gen` — run the repository's code-generation script.
- `npm run dead-code` — fail on an export nothing references (`-- --all` also lists test-only and file-local ones).

Inspect `package.json` if a command is uncertain. Do not invent script names or assume tools or scripts are available without checking.

## Implementation Workflow

For each task:

1. **Understand the request.** Identify the intended behavior, constraints, and acceptance criteria.
2. **Inspect the relevant documentation.** Read the applicable rules, conventions, architecture documents, and local README files.
3. **Discover existing implementations.** Search for related code, public APIs, shared utilities, types, and tests.
4. **Make the smallest complete change.** Follow existing architectural boundaries and avoid unrelated refactoring.
5. **Validate behavior.** Add or update tests when appropriate, and check error cases, authorization, input validation, and accessibility where relevant.
6. **Update documentation.** Keep documentation aligned with behavior and established architecture.
7. **Run verification.** Execute the narrowest relevant checks, followed by `npm run check` for substantial changes when feasible.
8. **Report the result.** Summarize what changed, the verification performed, and any known limitations or follow-up work.

Do not broaden the task without a clear reason. If an adjacent issue must be addressed for correctness or security, explain why it is necessary.

## Agent Skills

The repository ships agent skills in `.agents/skills/` (Codex, Gemini CLI and other agents that read `.agents/skills`) and an identical copy in `.claude/skills/` (Claude Code). `__tests__/architecture/agent-skills.test.ts` keeps both trees in step; change a skill in both places.

Load the matching skill before you start:

| Skill                     | Use when                                                                         |
| ------------------------- | -------------------------------------------------------------------------------- |
| `test-driven-development` | implementing a feature, fixing a bug or changing behavior (default for all code) |
| `systematic-debugging`    | a test, the build or CI fails, or the app misbehaves                             |
| `writing-plans`           | before a multi-file change or parallel work; includes time-boxed spikes          |
| `lean-code`               | writing or reviewing code; keeps diffs small and reuses what exists              |
| `code-review`             | before committing or opening a PR, or when reviewing one; drives `docs/agents/`  |
| `demo-flow-qa`            | after a user-facing feature, before a demo or merge; real browser, DE/EN, mobile |
| `ui-polish`               | building or refining a screen within the existing design system                  |

Skills are working procedures. Rules, conventions and architecture documents take precedence over them.

## Next.js Version-Specific Instructions

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Completion Requirements

Before considering a task complete:

- Follow the applicable rules, conventions, and architecture documentation.
- Preserve module boundaries and dependency direction.
- Validate external input and enforce authentication, authorization, and ownership/access scope where required.
- Handle errors intentionally; do not silently discard failures.
- Keep business logic out of framework entry points when it belongs in an application or domain layer.
- Reuse existing shared utilities and abstractions when appropriate.
- Preserve type safety; avoid `any` and unsafe casts unless justified.
- Add or update tests for changed behavior and relevant edge cases.
- Follow the repository's internationalization, accessibility, and UI conventions where applicable.
- Update relevant documentation when behavior, interfaces, or established practices change.
- Keep `AI_RULES.md` synchronized with changes to `docs/rules/`.
- Run relevant checks and accurately report their results.
- Keep changes focused and do not introduce unrelated files, dependencies, or abstractions.

## Tracking Open Work

Do not assume the repository has a central backlog or TODO file.

Use the issue tracker, task description, and relevant documentation supplied for the current task. Treat existing code comments as context, not as authoritative requirements. Do not create a new backlog or tracking document unless the task calls for one.
