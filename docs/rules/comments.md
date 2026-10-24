# Comment Rules

- Explain why, not what. Do not restate code in comments.
- Comment non-obvious business rules and invariants where they are enforced.
- Reference the owning rule file when code exists to satisfy an architectural constraint.
- Document exported functions, types, and public module APIs with JSDoc when behavior or constraints cannot be expressed by their signatures.
- Delete commented-out code; use version control.
- Update or remove comments when their code changes.
- Every TODO must name an owner or tracked issue.
- Every lint/type-disable directive needs a one-line justification beside it.
- Do not use section-marker comments; split the file or extract a function instead. See [code-style.md](code-style.md).
