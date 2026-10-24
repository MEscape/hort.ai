# Caching Rules

- Define cache ownership, lifetime, and invalidation for every cache.
- Cache only data whose consistency requirements permit it.
- Never cache secrets.
- Include every result-affecting value in cache keys, including user or owner identity when relevant.
- Prefer precise invalidation. Mutations must invalidate every affected entry.
- Do not use caching to hide inefficient application logic.
- Do not cache authorization decisions without an explicit identity boundary. See [security.md](security.md).
- Document non-obvious cache lifetimes. See [comments.md](comments.md).
- Prefer framework cache primitives at the delivery boundary.
- Keep business logic independent of caching implementations.
