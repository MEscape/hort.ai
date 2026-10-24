# Error Handling Rules

- Use neverthrow for expected application failures: Result for recoverable business/application errors and ResultAsync for predictable asynchronous failures.
- Never use exceptions for normal business control flow. Throw only for unexpected programmer or system failures callers are not expected to recover from.
- Give domain errors explicit types and stable error codes.
- Make application errors actionable.
- Map infrastructure errors before they cross the infrastructure boundary.
- Never expose infrastructure details to users.
- Map error codes to UI or HTTP responses at the presentation boundary. See [api.md](api.md) and [i18n.md](i18n.md).
- Catch errors only when the current layer can handle or translate them meaningfully.
- Preserve the original cause when translating unexpected failures.
- Name errors for what happened, not how the error was transported. See [naming.md](naming.md).
- Log unexpected errors once, at the boundary that handles them. See [observability.md](observability.md).
