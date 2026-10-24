# Adding a Rate Limit

Owning rules: [`security.md`](../rules/security.md), [`errors.md`](../rules/errors.md), [`architecture.md`](../rules/architecture.md), [`testing.md`](../rules/testing.md). For how the pieces fit together, see [`rate-limiting.md`](../architecture/rate-limiting.md).

Generator: none ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Decide whether the operation needs a budget. Apply rate limiting when anyone can repeatedly invoke a public operation or when each run incurs a cost, such as sending mail, making an external call, writing an entire page, or doing work that scales with the data. A public use case that does not need a limit must explain why using `@rate-limit none <reason>` in its class comment.
2. Choose what is counted: the authenticated actor, the caller's address from `ClientAddressProvider`, an account identifier such as an email address, or a deliberate global cap. Derive actor identity from the context the use case has authorized. Include tenant, account, or other scope only when required by the domain. Normalize and hash account identifiers through the limiter. Never use an untrusted raw request value as an identity.
3. Declare the policy in the module's `application/rate-limits.ts`. Specify `id` (`<module>.<operation>` in kebab-case, adding `-client` for address-based policies), `limit`, `windowSeconds` (using `SECONDS_PER_MINUTE` or `SECONDS_PER_HOUR`), and `onBackendFailure`. Client policies must also specify `onUnresolvedClient`. Document the rationale for the chosen limit and window in a comment above the policy.
4. Choose the failure behavior. Operations that send mail, call external systems, change live content, or authenticate users must use `'deny'`. Using `'allow'` requires a reason explaining why a temporary protection gap is less harmful than refusing legitimate users. Mark the policy with a `// @fail-open <reason>` comment; the module's role must allow it (`ROLES.<role>.rateLimitsMayFailOpen` in `eslint/policy/policy.mjs`).
5. Add the required use-case dependencies: `rateLimiter: RateLimiter` and, for client policies, `clientAddress: ClientAddressProvider`. Import these types from `@lib/rate-limit` using `import type`. Wire the dependencies in `composition.ts` with `getRateLimiter()` and `getClientAddressProvider(() => headers())`.
6. Spend the budget in the use case. For signed-in operations, enforce the limit after authorization; for public operations, enforce it before other work. Pass multiple budgets through one `enforceAll` call, checking the address budget first. Map a refusal to the module's own error using `fromRateLimitFailure`.
7. If the module does not yet define rate-limit errors, add `rateLimited` and `rateLimiterFailed` codes to `domain/errors/<module>-errors.ts`. Map them in `presentation/messages/message-keys.ts` and add the `errors.rateLimited` translation in every locale.
8. Test the use case with the real in-memory limiter from `createTestRateLimiter` in `__tests__/src/support/rate-limiting.ts`. Verify that the use case refuses attempts after the limit, counts different callers separately where appropriate, and follows the configured failure behavior when the store is unavailable. Use `createBrokenRateLimiter` to test store failures.
9. Run `npm run check`. Review the `rate-limit-usage` lint rule and policy-check results, and resolve any reported omissions.

## Done when

- [ ] The policy is declared in `application/rate-limits.ts` and enforced by a use case, not an action or adapter.
- [ ] The failure behavior is explicit, with every fail-open policy carrying a `@fail-open` reason.
- [ ] Rate-limit failures map to the module's own translated error.
- [ ] Tests cover the limit, caller separation where applicable, and backend-failure behavior.
- [ ] `npm run check` passes.
