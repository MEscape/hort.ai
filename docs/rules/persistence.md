# Persistence Rules

- Keep Prisma in infrastructure; enforce import boundaries through [boundaries.md](boundaries.md).
- Never expose Prisma models or generated types beyond infrastructure.
- Implement domain ports through repositories. Application use cases depend on repository abstractions, never Prisma.
- Map Prisma records to domain models and domain models to persistence shapes.
- Keep database queries in repositories or dedicated infrastructure services.
- Orchestrate transactions in application/infrastructure, never UI code. Align transaction boundaries with application use cases.
- Use database constraints to reinforce important domain invariants.
- Implement compare-and-swap as one UPDATE ... WHERE statement. With updateAndCount, a count of 0 means the operation lost. Never use update(): the ORM reads the row then writes by key, allowing a competing writer to pass the check.
- Inside a transaction, start every query from its transaction handle. Queries started from db use another connection and bypass the transaction, its locks, and rollback.
- Enforce domain rules in domain code, not through queries alone.
- Select only fields required by the use case.
- Avoid N+1 queries. See [performance.md](performance.md).
- Keep Prisma-specific errors inside infrastructure. See [errors.md](errors.md).
- Ship schema changes as reviewed migrations; never edit an applied migration.
- Filter owner-scoped table queries by their owner column (or document with @owner-scope).
- Store file bytes in object storage, not the database. Store ownership and metadata in the database; the row determines whether a file exists.
- Store timestamps in UTC.
- Store money as integer minor units or decimal, never floating point.
