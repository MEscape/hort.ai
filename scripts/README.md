# Generators

Scaffolding for the repetitive, mechanical parts of adding code. The generators produce code that
follows the architecture policy; they do not replace the checklists in
[docs/conventions](../docs/conventions), and they print every step that still needs a decision.

```bash
npm run gen                       # list the commands
npm run gen -- <command> --help   # usage, flags and examples of one command
```

Every command supports `--dry-run`, which validates everything and lists what would change
without writing. Errors exit with code 1.

The command registry is `scripts/commands/index.ts`. A test (`__tests__/scripts/conventions.test.ts`)
keeps it in step with `docs/conventions`: every convention carries a `Generator:` line naming its
command (or `none`), and every command names the convention it automates.

## Brand assets

`npm run brand:generate` exports the canonical owl and wordmark SVG sources to the app, browser, Apple, manifest, email and social formats. Generated files are checked in. The script uses Sharp from Next.js's installed dependencies; it calls no network service. See [branding](../docs/architecture/branding.md) for the asset inventory and editing workflow.

## Dead code

`npm run dead-code` is not a generator but the same kind of repository tool: it fails (exit 1) on
an export in `src/` that nothing references, tests included. It runs in `npm run check` and in CI.

```bash
npm run dead-code                                   # fail on exports used by nothing at all
npm run dead-code -- --all                          # also list exports only tests use, or only their own file
npm run dead-code -- --scope=src/modules/profile    # judge one folder (every file still counts as a user)
```

An export that something the compiler cannot see needs (a string lookup, a framework convention)
says so with `/** @keep <reason> */`. Public entry points (`index.ts`, `client.ts`, `server.ts`,
route and metadata files in `src/app`) are never reported. The logic lives in
`scripts/lib/dead-code.ts`; `__tests__/scripts/dead-code.test.ts` covers it. Remove a shared piece
when its last consumer goes ([`adding-a-shared-utility`](../docs/conventions/adding-a-shared-utility.md)).

## Commands

| Command                                    | What it does                                                                                                    | Convention doc                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `module <name> --fields "<fields>"`        | A complete business module: domain, application, infrastructure, presentation, a domain test, i18n registration | [`adding-a-module`](../docs/conventions/adding-a-module.md)                               |
| `usecase <name> -m <module> [--query]`     | One command or query in an existing module, registered in its `composition.ts`                                  | [`adding-a-use-case`](../docs/conventions/adding-a-use-case.md)                           |
| `usecase <name> -m <module> --action`      | Also the Server Action and input schema, for a command that takes `{ id }`                                      | [`adding-a-server-action`](../docs/conventions/adding-a-server-action.md)                 |
| `component <name> [-m <module>]`           | A shared composite (`src/components/shared`) or a module component, with a render test                          | [`adding-a-ui-component`](../docs/conventions/adding-a-ui-component.md)                   |
| `env <NAME> [--public]`                    | An entry in the right section of `.env.example`; prints the schema line                                         | [`adding-an-environment-variable`](../docs/conventions/adding-an-environment-variable.md) |
| `translation <key> "<text>" [-m <module>]` | One message in every locale at once                                                                             | [`adding-a-translation`](../docs/conventions/adding-a-translation.md)                     |

```bash
npm run gen -- module inventory --entity item \
  --fields "name:string,note:string?,quantity:number,status:enum(draft|sent|paid),dueAt:date?" \
  --unique name
npm run gen -- usecase archive-item -m inventory --action
npm run gen -- component item-summary -m inventory
npm run gen -- env STRIPE_SECRET_KEY --description "Stripe API secret"
npm run gen -- translation errors.locked "Item {name} is locked" --de "Element {name} ist gesperrt" -m inventory
```

### Field syntax (`module`)

`name:type`, `name:type?` for optional, `name:enum(a|b)`. Types: `string`, `number`,
`money` (non-negative integer minor units), `boolean` (never optional), `date`, `enum`.
`id`, `tenantId`, `createdAt` and `updatedAt` are always generated. `--unique a,b` makes required
fields unique **per tenant**.

Module names, stems and entities are kebab-case. `--stem` (default: the singular of the module
name) names module-level files and symbols; `--entity` (default: the stem) names entity-level ones.
Add `--client` for a browser-safe `client.ts`.

## What you still do by hand

`module` and `usecase` print these steps at the end of every run, because each one needs a
decision or a migration:

- the Prisma model (printed ready to paste) and its migration
  ([`adding-a-database-migration`](../docs/conventions/adding-a-database-migration.md)), then `npm run db:generate`
- the permissions and their grants per role in `src/modules/auth/domain/models/{permission,role}.ts`
- for a command: its audit event in the module's audit port and logger (the architecture policy
  fails until it exists, which is the point)
- pages, components and business rules beyond the field shape that is validated for you

## Safety

- **Nothing is overwritten.** If any target already exists, the whole run aborts and lists all
  conflicts; no file is written. There is no force mode.
- **All or nothing.** Every change is planned and validated first. If a write fails midway,
  everything already written is rolled back.
- **Edits to existing files are narrow and checked.** `module` registers the i18n namespace in
  `src/i18n/locales/*.ts`, `usecase` adds one import and one property to `composition.ts`, `env`
  and `translation` add one entry. If the file does not have the expected shape, the run aborts
  and prints the exact lines to add by hand (`usecase` also has `--no-wire`).
- **Names are validated, never rewritten.** `../x`, `a/b`, `Order` and reserved words are errors.
  Paths are checked against the repository root, including symlinks.
- Behaviour does not depend on the working directory.

## Limits

- `module` generates one kind of module: a tenant-owned entity with create, update, delete, get
  and list. Read-only or integration modules and the platform module (`auth`) are hand-built.
  The generated code imports `@modules/auth` (`AuthorizationService`, `Actor`, `Permission`,
  `ResourceScope`, `TenantId`, `getAccessControl`), so it compiles only once that module exists.
- `usecase` works on modules in the standard shape, i.e. every `gen module` output.
  It reads the module's own loader, permission and event names and refuses modules that deviate
  (for example an integration module), naming what is missing. Write those use cases by hand.
- Not generated, on purpose: repositories for additional entities, route handlers, shared
  utilities, migrations. Follow the checklists in `docs/conventions`.
- The generated `scopeOf` returns `{ tenantId }` only, but the auth module's `ResourceScope` also requires the resource's `ownerId` (the parent it belongs to), so generated modules do not compile against it until the entity carries an owner and `scopeOf` returns it ([`authentication.md`](../docs/architecture/authentication.md)).
- Enum fields become Prisma enums with explicit mapper tables. Soft delete is not supported
  (no module uses it).

## Maintaining the generators

[`CONVENTIONS.md`](CONVENTIONS.md) records which source of truth each template follows and the
decisions where the codebase is inconsistent. Change a template only together with that.

```bash
npm test                 # includes __tests__/scripts
npm run test:architecture
```

`__tests__/scripts` generates into temporary repositories seeded from the real one and checks
paths, imports, determinism, conflicts, rollback and path safety. Generated modules are also run
through `runAllChecks` and the architecture ESLint rules, and through the repository's
`import/order` configuration and its complexity and parameter limits.

The tests cannot compile generated code, because that needs your Prisma model and permissions.
After changing a template, verify it once against the real contract: generate a module, apply the
printed steps, run `npm run db:generate && npm run typecheck && npm run lint`, and remove the
module again.

## Dead code

`npm run dead-code` is not a generator but lives here with the other repository tooling. It reads the project the way the editor does (`tsconfig.json`, path aliases, re-exports) and lists every export of `src` that nothing references: `dead` (not even a test or its own file) fails the run, `test-only` and `unneeded-export` are listed with `--all`. Entry points the framework or the public API reads by name (`page.tsx`, `route.ts`, a module's `index.ts`, `client.ts` and `server.ts`) are not judged, and an export that something the compiler cannot see needs says so with `/** @keep <reason> */`. The analysis is `scripts/lib/dead-code.ts`; it runs in CI next to lint and as part of `npm run check`.
