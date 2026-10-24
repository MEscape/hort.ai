---
name: lean-code
description: Use when writing, changing or reviewing code in HortAi to keep the diff small. Reuse what exists, avoid speculative abstractions and new dependencies, and never cut corners on validation, security or accessibility.
---

# Lean Code

The best code is code you did not have to write. Lean means efficient, not careless.

## Before writing anything, stop at the first rung that holds

1. **Does this need to exist?** If the task does not require it, skip it and say why.
2. **Is it already in the repo?** Check `src/lib/README.md`, `src/components/README.md`, the existing modules and the generators (`npm run gen`). Reuse before you rewrite.
3. **Does the platform already do it?** TypeScript/Node standard library, the browser, Next.js, React, Zod, neverthrow.
4. **Does an installed dependency solve it?** Check `package.json` before adding a package. New dependencies follow `docs/rules/dependencies.md`.
5. **Only then** write the minimum code that works.

## Rules

- No abstraction without a second real use case.
- Deletion over addition; boring over clever; fewest files possible.
- Small, focused diffs. No drive-by refactors, renames or formatting of untouched code.
- Fix the root cause in the owning layer, not a local guard at every caller.
- If you knowingly accept a limit (naive heuristic, in-memory store, hard-coded list for the demo), leave a short comment that names the limit and the upgrade path.

## Never cut corners on

- Understanding the code path before changing it.
- Zod validation at trust boundaries, authentication, authorization and tenant scope.
- Error handling that could lose data or hide failures.
- Accessibility: real semantics, labels, focus and keyboard behavior, not only visuals.
- Tests for non-trivial logic (see the `test-driven-development` skill).
- Anything the user explicitly asked for.

## In review

Return a concrete **delete / reuse / simplify** list: duplicated utilities, unnecessary dependencies, premature abstractions, multi-file churn where one local change works, symptom patches. Also flag the opposite: missing validation, security or accessibility caused by over-minimizing.
