# Adding an Environment Variable

Owning rules: [`configuration.md`](../rules/configuration.md), [`security.md`](../rules/security.md), [`validation.md`](../rules/validation.md), [`naming.md`](../rules/naming.md).

Generator: `npm run gen -- env <NAME> [--public]` ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Decide whether the variable is server-only or public. Secrets must always be server-only. Use the `NEXT_PUBLIC_*` prefix only for values that are safe to expose to the browser.
2. Name the variable in `UPPER_SNAKE_CASE`. See [`naming.md`](../rules/naming.md).
3. Add it to the appropriate Zod schema in `src/lib/config`, with the correct type and a default only when that default is safe. Cross-variable requirements, such as "required once X is enabled" or "HTTPS in production", belong in the domain's `EnvRule` table, not in ad hoc schema conditionals. See `@lib/config` in [`src/lib/README.md`](../../src/lib/README.md).
4. Read the variable only through the typed configuration module. Do not access `process.env` elsewhere.
5. Add the variable to `.env.example` with a safe placeholder and a one-line description. Never commit a real secret.
6. Confirm that the application fails fast at startup when the variable is missing or malformed and no safe default applies.
7. Configure the variable in every required deployment environment before merging.

## Scaffolding

`npm run gen -- env <NAME> [--public]` adds the entry to the appropriate section of `.env.example` and prints the schema line and default constant to add to `src/lib/config/env-schema.ts`.

See [`scripts/README.md`](../../scripts/README.md).

## Done when

- [ ] The variable is validated at startup.
- [ ] No direct `process.env` access exists outside the configuration module.
- [ ] `.env.example` documents the variable with a safe placeholder.
- [ ] No secret uses the `NEXT_PUBLIC_*` prefix.
- [ ] Required deployment environments are configured.
