# Adding a Use Case

Owning rules: [`modules.md`](../rules/modules.md), [`errors.md`](../rules/errors.md), [`validation.md`](../rules/validation.md), [`security.md`](../rules/security.md), [`naming.md`](../rules/naming.md).

Generator: `npm run gen -- usecase <name> -m <module>` ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Decide whether the operation is a command (changes state) or a query (reads state). Name it according to [`naming.md`](../rules/naming.md), for example `CancelSubscription` or `GetOrderById`.
2. Define the input type and error union. Errors must carry stable codes. See [`errors.md`](../rules/errors.md).
3. Define or extend the domain port the use case needs. Do not import Prisma or infrastructure implementations.
4. Implement the use case in `application/`. Return `Result` or `ResultAsync`. Keep the use case focused: move parsing, context loading, decision logic, and view mapping into `application/services/` when they form separate responsibilities. Use one file per job, named for that job. More than three local helpers is a signal to extract a service; lint reports this condition. See [`modules.md`](../rules/modules.md).
5. Enforce authorization inside the use case. See [`security.md`](../rules/security.md). A public use case, or one whose every invocation incurs a cost, must also enforce a rate-limit budget or document why it does not need one. See [`adding-a-rate-limit.md`](adding-a-rate-limit.md).
6. Implement required ports in `infrastructure/`, using repositories and mappers to translate persistence records into domain models. See [`adding-a-repository.md`](adding-a-repository.md).
7. Add the appropriate delivery adapter:
   - **Mutation from the UI:** use a Server Action in `presentation/actions/` and validate input with Zod first. See [`adding-a-server-action.md`](adding-a-server-action.md).
   - **Real HTTP consumer:** use a Route Handler. See [`adding-a-route-handler.md`](adding-a-route-handler.md).
   - **Read from a Server Component:** call the query directly. See [`nextjs.md`](../rules/nextjs.md).
8. Export the use case from the module's `index.ts` only when other modules or the application need to access it.
9. Test the use case with port fakes, then test the delivery adapter through its observable behavior. See [`testing.md`](../rules/testing.md).
10. Invalidate affected cache entries when the use case mutates cached data. See [`caching.md`](../rules/caching.md).

## Scaffolding

`npm run gen -- usecase <name> -m <module>` creates the use case and registers it in `composition.ts`. Add `--query` for a query.

For a command, add the required permission and audit event manually; the generator prints both follow-up steps.

This generator supports modules using the standard structure. See [`scripts/README.md`](../../scripts/README.md).

## Done when

- [ ] The use case has no framework, Prisma, or HTTP imports.
- [ ] The use case file is within the size limit, and extracted helpers live in `application/services/`.
- [ ] No service imports a command or query.
- [ ] Every expected failure returns a typed error rather than throwing.
- [ ] Authorization is enforced in the use case, not only in the UI or adapter.
- [ ] A public or cost-incurring use case enforces a rate limit or documents why one is unnecessary.
- [ ] Tests cover success and relevant failure paths.
