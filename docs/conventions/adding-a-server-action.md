# Adding a Server Action

Owning rules: [`nextjs.md`](../rules/nextjs.md), [`validation.md`](../rules/validation.md), [`security.md`](../rules/security.md), [`errors.md`](../rules/errors.md), [`i18n.md`](../rules/i18n.md).

Generator: `npm run gen -- usecase <name> -m <module> --action` ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Confirm that a use case already exists. A Server Action is a delivery adapter and must not contain business logic. See [`adding-a-use-case.md`](adding-a-use-case.md).
2. Create the action in `presentation/actions/` and include the `use server` directive.
3. Define a Zod input schema next to the action. Parse `FormData` here; never pass raw `FormData` into the use case. See [`validation.md`](../rules/validation.md).
4. Resolve the authenticated identity from the server-side authentication context. Never trust a user ID or tenant ID supplied by the client. See [`security.md`](../rules/security.md).
5. Call the use case with validated, typed input.
6. Map the use case's `Result` to the action's return type: success data or field-level errors with an optional form-level error code. Return stable codes, not localized messages. Preserve `retryAfterSeconds` when an attempt is refused. The use case, not the action, enforces the rate limit; see [`adding-a-rate-limit.md`](adding-a-rate-limit.md).
7. Revalidate or invalidate affected cache entries after a successful mutation. See [`caching.md`](../rules/caching.md).
8. On the client, show pending state, prevent accidental double submission, and preserve user input when validation fails.
9. After a failed submission, move focus to the first invalid field or to an error summary. See [`accessibility.md`](../rules/accessibility.md).
10. Test the action through its observable behavior, including unauthorized and invalid-input paths.

## Scaffolding

For a command that takes only `{ id }`, run:

`npm run gen -- usecase <name> -m <module> --action`

This generates the action and its input schema together with the use case. Write actions with richer input by hand.

See [`scripts/README.md`](../../scripts/README.md).

## Done when

- [ ] Input is validated before the use case is called.
- [ ] Identity is derived from server-side authentication context.
- [ ] The action contains no business logic and returns no localized messages.
- [ ] Cache entries are invalidated where required after successful mutations.
- [ ] Unauthorized and invalid-input paths are tested.
