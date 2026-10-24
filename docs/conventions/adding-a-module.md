# Adding a Module

Owning rules: [`architecture.md`](../rules/architecture.md), [`modules.md`](../rules/modules.md), [`boundaries.md`](../rules/boundaries.md), [`naming.md`](../rules/naming.md).

Generator: `npm run gen -- module <name> --fields "<fields>"` ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Confirm that the capability is a distinct business concept, not a technical concern. Technical functionality belongs in shared code. See [`shared.md`](../rules/shared.md).
2. Create `modules/<kebab-case-name>/` with only the layers needed for the capability.
3. Start with `domain/`: define models, typed errors, and ports. See [`modules.md`](../rules/modules.md) and [`boundaries.md`](../rules/boundaries.md).
4. Add commands and queries in `application/`, depending on ports rather than infrastructure implementations. See [`adding-a-use-case.md`](adding-a-use-case.md).
5. Add port implementations in `infrastructure/`. Keep Prisma-specific code here. See [`adding-a-repository.md`](adding-a-repository.md).
6. Add `presentation/` last, with the required actions, DTOs, and components.
7. Create `composition.ts` to wire use cases, adapters, and other modules. Create `index.ts` as the server-side public API. Add `client.ts` only if browser-side code in other modules needs a public client API. See [`boundaries.md`](../rules/boundaries.md).
8. Verify that lint catches a deliberate boundary violation, such as importing Prisma from `domain/`.
9. Add tests at each relevant layer. See [`testing.md`](../rules/testing.md).
10. Add or update translation keys where needed. See [`i18n.md`](../rules/i18n.md).

## Target layout

The following is the typical layout. Create only the layers and files the module needs; `client.ts` is optional.

```text
modules/<module>/
├── domain/
├── application/
├── infrastructure/
├── presentation/
│   ├── actions/
│   ├── components/
│   ├── dto/
│   └── i18n/
├── composition.ts
├── index.ts
└── client.ts  # Optional: public API for browser-side consumers
```

## Scaffolding

`npm run gen -- module <name> --fields "<fields>"` creates the standard layout, registers the i18n namespace, and adds a domain test. It prints the remaining manual steps, including the Prisma model and migration, permissions, UI, and business rules.

See `scripts/README.md`.

## Done when

- [ ] Lint and type-check pass.
- [ ] Cross-module imports use `index.ts` or `client.ts` rather than bypassing the public API.
- [ ] Runtime calls into another module are wired only in `composition.ts` or an adapter.
- [ ] The module's translations live in its own namespace and are listed in `src/i18n/locales/*.ts`.
- [ ] No Prisma or Next.js imports exist in `domain/` or `application/`.
- [ ] Tests cover the relevant domain, application, infrastructure, and presentation behavior.
