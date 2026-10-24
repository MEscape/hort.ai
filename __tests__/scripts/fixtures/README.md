# Fixtures

Frozen copies of the repository files the generators read or edit (locale registries, app
messages, `.env.example`, the Prettier config). The `.txt` suffix keeps ESLint, Prettier and
`tsc` away from them.

The generator tests seed temporary repositories from these copies, so they pass no matter what
the real files contain at the moment (for example after you generated a module for real).
`real-repo-shapes.test.ts` separately checks, without writing, that the real files still have the
shape the generators expect. When that test fails, the real files changed shape: update the
generator, then refresh these copies.
