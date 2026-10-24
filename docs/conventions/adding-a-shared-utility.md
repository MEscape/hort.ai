# Adding a Shared Utility

Owning rules: [`shared.md`](../rules/shared.md), [`architecture.md`](../rules/architecture.md), [`dependencies.md`](../rules/dependencies.md), [`naming.md`](../rules/naming.md).

Generator: none; run `npm run dead-code` when a consumer goes ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Check [`src/lib/README.md`](../../src/lib/README.md) first. If `@lib/utils` already provides the helper, reuse it rather than writing a local copy. Lint also flags hand-written versions of common utilities. Then check whether the platform already provides the functionality, for example through `structuredClone`, `Object.hasOwn`, `Object.groupBy`, or `Intl`. Do not reimplement an existing utility. See [`dependencies.md`](../rules/dependencies.md).
2. Confirm that the utility is genuinely generic. If it depends on a domain concept, Prisma, or HTTP behavior, keep it in the owning module or layer. See [`shared.md`](../rules/shared.md).
3. Check how many independent call sites need it. Extract a shared utility only after a third independent use.
4. Put the utility in a file named for its concern, such as `array.ts`, `string.ts`, or `async.ts`. Never create `helpers.ts` or `misc.ts`. See [`naming.md`](../rules/naming.md).
5. If the utility requires a third-party library, place it in its own file so dependency-free utilities remain dependency-free.
6. Return a `Result` for predictable failures. Throw only for programmer errors, and document that behavior. See [`errors.md`](../rules/errors.md).
7. Write a doc comment describing the utility's behavior and constraints. Do not reference domain concepts. See [`comments.md`](../rules/comments.md).
8. Export the utility from the shared `index.ts`.
9. Add unit tests, including edge cases and invalid input. Shared code has no module-level safety net, so its behavior must be tested directly.

## Done when

- [ ] The utility contains no domain, Prisma, or HTTP-specific knowledge.
- [ ] The platform and existing shared utilities do not already provide the functionality.
- [ ] The utility is in a concern-specific file with a public export.
- [ ] Predictable failures are represented consistently with the shared error conventions.
- [ ] Unit tests cover normal behavior and relevant edge cases.
