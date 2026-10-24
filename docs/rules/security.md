# Security Rules

- Treat all client input as untrusted. See [validation.md](validation.md).
- Authenticate every protected operation and authorize every protected use case.
- Never rely on UI visibility for authorization. Server Actions enforce authorization independently.
- Never expose secrets to Client Components.
- Never log credentials, tokens, session secrets, or sensitive personal data. See [observability.md](observability.md).
- Derive identity from server-side authentication context; never trust client-provided user or owner IDs for authorization.
- Enforce owner isolation at the application/data-access boundary.
- Rate-limit and bound externally reachable inputs using declared policies. See [../architecture/rate-limiting.md](../architecture/rate-limiting.md).
- Store keyed hashes in counters, never raw identifiers or addresses.
- Store files through the shared ObjectStore port. Derive object keys from trusted IDs (owner, asset), never user filenames. Create the database row before authorizing upload. Treat signed URLs as bearer credentials: never log or store them. Deliver private files only through short-lived signed URLs.
- Verify webhook authenticity before processing payloads.
- Protect state-changing requests against CSRF. Use secure, HttpOnly, SameSite session cookies.
- Set standard security headers: CSP, X-Content-Type-Options, Referrer-Policy, and frame protections.
- Never render untrusted content as raw HTML. Sanitize it first if unavoidable.
- Prefer allowlists over blocklists for security-sensitive decisions.
- Forbid dangerouslySetInnerHTML unless content is explicitly sanitized and the use is justified inline.
