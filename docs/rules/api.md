# API Rules

- Treat HTTP as a delivery mechanism, not an application layer.
- Create Route Handlers only for real HTTP consumers.
- Validate all request inputs at the HTTP boundary. See [validation.md](validation.md).
- Authenticate protected requests and authorize operations at the application boundary. See [security.md](security.md).
- Route Handlers call application use cases or queries; they contain no business logic.
- Map application Results to specific HTTP responses. Never turn an expected failure into a generic 500. See [errors.md](errors.md).
- Return explicit response DTOs, never domain or persistence objects.
- Use consistent HTTP status semantics and error response shapes.
- Never expose internal exception messages.
- Version public APIs; preserve published contracts.
- Make non-idempotent operations safe to retry when clients may retry them.
- Keep HTTP-specific types out of domain and application code.
- Verify webhook authenticity before processing payloads. See [security.md](security.md).
