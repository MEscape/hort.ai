# TypeScript Rules

- Use strict TypeScript, including noUncheckedIndexedAccess.
- Do not use any unless unavoidable and justified inline. See [comments.md](comments.md).
- Use unknown for untrusted values and narrow before use.
- Use discriminated unions for finite states and variant-specific data.
- Use exhaustive checks where adding a variant must reveal missing handling at compile time.
- Prefer satisfies to validate object shapes without losing inference.
- Use mapped or conditional types when they keep related types synchronized.
- Prefer branded types for important identifiers.
- Prefer narrowing over type assertions; never use non-null assertions to hide missing invariants.
- Use import type for type-only imports.
- Keep domain types independent of framework-generated types.
- Make domain value objects immutable and validate invariants at construction.
- Prefer inferred types for local implementation details; explicitly type public module APIs.
- Derive related types from one source, such as z.infer, instead of duplicating representations. See [validation.md](validation.md).
- Follow [naming.md](naming.md).
