# Module Rules

- Put each business capability under modules/<module>.
- Modules may contain domain, application, infrastructure, and presentation layers.
- domain contains models, errors, and ports.
- application contains commands, queries, shared contracts (inputs, views, constraints), and services.
- application/services holds reusable use-case support: parsing, context loading, decisions, and view mapping. Services access data only through domain ports. Commands and queries call services; services never import commands or queries, and queries never import commands.
- Keep commands and queries short. If a use case has more than three local helpers beyond execute, move them into a one-file-per-job service. Lint enforces architecture/application-flow and architecture/use-case-helpers.
- infrastructure implements ports and external integrations.
- presentation contains actions, DTOs, and module-specific components.
- Server Actions are framework adapters in presentation/actions and call only application use cases. See [nextjs.md](nextjs.md).
- Put module-specific components in presentation/components; put shared UI outside modules.
- Never import another module's infrastructure or internals. Use its public API.
- composition.ts is the module's composition root: the only file that knows both its use cases and adapters, and the only place another module is wired in.
- index.ts exposes the intentional server-side API; client.ts exposes browser-safe APIs (Server Actions, routes, DTO types, vocabulary). No other file may serve as a barrel.
- Export only intentional public members. Use named re-exports, never export *.
- When referencing another module's aggregate, define a local branded reference ID under the same brand name (e.g. ProfileId).
- Protect every use case by default. Public or system use cases require an @authorization <category> <reason> tag and an entry in the reviewed architecture-test list.
- Follow [naming.md](naming.md) for file and directory names.
