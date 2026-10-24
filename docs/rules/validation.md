# Validation Rules

- Validate all external input at the system boundary; never trust client-side validation.
- Use Zod in presentation for external input. Domain, application, and infrastructure must not import Zod.
- Use @lib/utils type guards to check unknown-shaped data below presentation.
- Define schemas close to the boundary they validate.
- Parse unknown external data before use.
- Prefer safeParse when validation failure is expected application flow; use parse when invalid input signals a programmer or invariant violation.
- Do not duplicate identical schemas across layers.
- TypeScript types do not replace runtime validation.
- Do not pass raw FormData or request JSON beyond presentation.
- Validate route parameters and search parameters.
- Validate environment variables at startup. See [configuration.md](configuration.md).
- Validate external API responses before mapping them into application types.
- Keep domain invariants in domain code even when Zod validates input.
- Follow [naming.md](naming.md) for schema names.
