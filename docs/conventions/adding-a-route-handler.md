# Adding a Route Handler

Owning rules: [`api.md`](../rules/api.md), [`nextjs.md`](../rules/nextjs.md), [`validation.md`](../rules/validation.md), [`security.md`](../rules/security.md), [`errors.md`](../rules/errors.md).

Generator: none ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Confirm that a real HTTP consumer exists, such as a webhook, mobile client, or third party. If the caller is your own UI, prefer a Server Action or Server Component.
2. Create `route.ts` under `app/api/...`. Keep the handler thin; it should adapt HTTP input and output and call a use case.
3. Validate the body, query parameters, headers, and route parameters with Zod where applicable. See [`validation.md`](../rules/validation.md).
4. Authenticate before protected operations, then authorize within the use case. See [`security.md`](../rules/security.md).
5. Call the use case and map its `Result` to a specific HTTP status code and the project's standard error-response shape. See [`errors.md`](../rules/errors.md).
6. Return an explicit response DTO. Never return domain models or persistence objects directly.
7. For webhooks, verify the signature and enforce replay protection before parsing or trusting the payload. Follow the provider's requirements for obtaining the raw request body.
8. Apply rate limiting to public endpoints through the use case; see [`adding-a-rate-limit.md`](adding-a-rate-limit.md). Map a rate-limit refusal to `429` and include `Retry-After` using `httpHeadersForError`. Bound the request body size.
9. Make retry-prone operations idempotent, especially when callers may retry after a timeout or uncertain response.
10. Test success, invalid input, unauthenticated and unauthorized requests, and each mapped failure.

## Done when

- [ ] The handler contains no business logic.
- [ ] Every relevant input source is validated.
- [ ] Status codes are specific; errors are not all mapped to `500`.
- [ ] Rate-limit refusals return `429` with `Retry-After`.
- [ ] No internal error message or sensitive implementation detail reaches the response.
- [ ] Tests cover the handler's observable behavior.
