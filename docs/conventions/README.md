# Conventions

Step-by-step procedures for recurring engineering tasks. Rules in [`rules/`](../rules/README.md) define what is allowed; conventions describe how to carry out a task.

Conventions link to rules rather than restating them. If a convention and a rule disagree, the rule takes precedence, and the convention must be corrected.

## Index

Generators are run as `npm run gen -- <command>`; see [`scripts/README.md`](../../scripts/README.md). Every convention names its generator (or `none`) on a `Generator:` line, and a test keeps that in step with the generator registry.

| Task                        | Convention                                                               | Generator                          |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| Add a business module       | [`adding-a-module.md`](adding-a-module.md)                               | `gen module`                       |
| Add a command or query      | [`adding-a-use-case.md`](adding-a-use-case.md)                           | `gen usecase`                      |
| Add a repository            | [`adding-a-repository.md`](adding-a-repository.md)                       | -                                  |
| Add a Server Action         | [`adding-a-server-action.md`](adding-a-server-action.md)                 | `gen usecase --action`             |
| Add a Route Handler         | [`adding-a-route-handler.md`](adding-a-route-handler.md)                 | -                                  |
| Add a shared utility        | [`adding-a-shared-utility.md`](adding-a-shared-utility.md)               | - (`npm run dead-code` afterwards) |
| Add a UI component          | [`adding-a-ui-component.md`](adding-a-ui-component.md)                   | `gen component`                    |
| Add a rate limit            | [`adding-a-rate-limit.md`](adding-a-rate-limit.md)                       | -                                  |
| Add an environment variable | [`adding-an-environment-variable.md`](adding-an-environment-variable.md) | `gen env`                          |
| Add a database migration    | [`adding-a-database-migration.md`](adding-a-database-migration.md)       | - (`gen module` prints the model)  |
| Add a translation           | [`adding-a-translation.md`](adding-a-translation.md)                     | `gen translation`                  |
| Fix a bug                   | [`fixing-a-bug.md`](fixing-a-bug.md)                                     | -                                  |

## Conventions for writing conventions

- Keep one task per file. Name files `adding-...` or `fixing-...`.
- Start with the owning rules and a `Generator:` line (the `npm run gen -- <command>` that automates the task, or `none`), followed by a numbered checklist and a `Done when` list.
- Make each checklist step an actionable instruction. Link to the owning rule instead of duplicating it.
- Keep checklists under twelve steps. Split a procedure if it grows beyond that limit.
- When a rule change alters a procedure, update the affected convention in the same change.
- Keep file paths, command names, API names, and generated artifacts consistent with the current repository.
- Prefer explicit completion criteria that can be verified through tests, lint, type-checking, or review.
- Do not document workflows for features, frameworks, or subsystems that the project does not use.
