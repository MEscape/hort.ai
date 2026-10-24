# Generator conventions

What the generators in this folder must produce, and where that is defined.
Change a template only together with the source of truth below.

## Sources of truth (in order)

1. `eslint/policy/policy.mjs` and `eslint/plugins/architecture/rules/*`: what is
   allowed. Generated code must pass `runAllChecks` and the architecture ESLint config.
2. The real modules under `src/modules` (none yet: the first one generated becomes the reference): what compiles and ships.
3. `__tests__/architecture/standard-module.ts`: the minimal standard module. It is a lint
   fixture, not compilable code (unknown permissions, no Prisma model), so it is **not** a
   template. Generated output is therefore also type-checked against the real Prisma contract.

## Names

| Identifier | Meaning                                          | Example (`lesson-plans`) |
| ---------- | ------------------------------------------------ | ------------------------ |
| `dir`      | module folder and i18n namespace (may be plural) | `lesson-plans`           |
| `stem`     | module-level files and symbols                   | `lesson-plan`            |
| `entity`   | entity-level files and symbols                   | `lesson`                 |

Module-level (`stem`): `<stem>-errors`, `<stem>-dependencies`, `<stem>-limits`,
`<stem>-view-mappers`, `<stem>-audit-log.port`, `<stem>Commands`, `<stem>Queries`,
`en<Stem>`. Entity-level: repository, record mapper, scope, `load-authorized-<entity>`, DTO,
schemas, actions. The permission resource is the entity name without separators
(`lessonplan.read`).

Names are never rewritten silently. Anything that is not kebab-case, or contains a reserved
word, is rejected.

## Decisions where the codebase is inconsistent

| Question                | Canonical                            | Why                                                           |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Audit adapter folder    | `infrastructure/audit/`              | the one home `policy.mjs` names for audit adapters            |
| Limits file             | `application/<stem>-limits.ts`       | the `limits-usage` rule names it; `list-limits.ts` is drift   |
| Module-level file names | use the stem, not the entity         | one stem names everything a module owns                       |
| Message keys            | typed `NestedKeyOf<MessageCatalog>`  | a typo is a compile error; requires the locale registration   |
| i18n export             | direct JSON re-export                | no indirection (`catalog.ts` is allowed but not generated)    |
| Enum columns            | Prisma enum + two-way mapper tables  | persistence rules: the DB constraint reinforces the invariant |
| `updatedAt`             | set by the repository from a `Clock` | Prisma 8 has no update hook                                   |
| `client.ts`             | optional (`--client`)                | only needed when another module's browser code imports it     |

## Prisma 8 idioms

`db.orm.public.<Model>.select(...SELECT).where(...)` with terminal `.first()`, `.all()`,
`.create()`, `.update()`, `.deleteAndCount()`; thunks are `async () => query`; dates are written
with `dateToInstant` and read with `instantToDate`; never import `@prisma/client`.

## Lint limits shape the templates

A generated file stays under the size limit (300 code lines, 200 in `application` and components), and a generated component stays within the logic limit (`architecture/component-logic`): state and effects belong in a hook, not in the template.

Complexity (12) and parameter (3) limits mean generated code must not grow a branch per field:
validation is one small function per field, and the record mapper converts through tiny helpers
and builds update data in blocks of 10 fields.

## What is generated and what is not

Generated: every file the policy requires for a business module, the locale registration in
`src/i18n/locales/*.ts`, and a domain test.

Printed, not applied (they need a decision or a migration): the Prisma model, the permissions
and role grants in `auth`, the migration, UI pages and components, and the business rules that
go beyond field shape.

## Safety rules for generators

- Plan every change first (`Plan`), validate it as a whole, write only if nothing conflicts.
- Never overwrite: an existing target aborts the run with the full list. There is no force mode.
- Edits of existing files must recognise the file's shape; otherwise abort and print the exact
  snippet to add by hand.
- Roll back every file already written if a later write fails.
