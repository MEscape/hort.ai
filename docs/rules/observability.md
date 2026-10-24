# Observability Rules

- Use structured logging; do not use console.log for application observability.
- Log at application and infrastructure boundaries, never in domain code.
- Never log secrets, credentials, tokens, session secrets, or sensitive personal data. See [security.md](security.md).
- Preserve error causes when translating errors. See [errors.md](errors.md).
- Include request/correlation IDs when available.
- Record unexpected failures with enough context to diagnose them.
- Instrument external integrations and important persistence operations.
- Use log levels consistently: error for unexpected failures, warn for recoverable anomalies, info for significant events, debug for diagnostics.
- Send audit events through the module's audit port with explicit event types and levels. See `createAuditLog` in [`src/lib/README.md`](../../src/lib/README.md#lib-logger).
- Audit entries may contain IDs, counts, and event codes, never sensitive personal data.
