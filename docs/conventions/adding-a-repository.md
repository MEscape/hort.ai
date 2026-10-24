# Adding a Repository

Owning rules: [`persistence.md`](../rules/persistence.md), [`boundaries.md`](../rules/boundaries.md), [`errors.md`](../rules/errors.md), [`naming.md`](../rules/naming.md).

Generator: none for an additional repository; `npm run gen -- module` generates the first one with its record mapper ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Define the port in `domain/`, named for the capability, such as `OrderRepository`. Use domain language in its methods and return domain models rather than persistence records.
2. Return `ResultAsync` for operations that can fail predictably. Do not expose Prisma or other ORM types through the port. See [`errors.md`](../rules/errors.md).
3. Create the implementation in `infrastructure/`, named for the technology, such as `PrismaOrderRepository`. See [`naming.md`](../rules/naming.md).
4. Define explicit mappings between persistence records and domain models wherever their shapes or responsibilities differ. Keep ORM-specific conversions inside infrastructure.
5. Select only the fields the use case needs. Avoid N+1 queries; batch or join related reads where appropriate.
6. Catch and map persistence errors inside the repository. Do not let raw database or ORM errors cross the infrastructure boundary.
7. Enforce the correct data-access scope for every query. Apply ownership, account, tenant, or authorization-related filters when required by the domain. Do not rely solely on identifiers supplied by callers when additional scope is required.
8. Bound list queries with pagination or an explicit limit. Define a deterministic ordering when results are paginated. See [`performance.md`](../rules/performance.md).
9. Handle transactions at the appropriate application or infrastructure boundary. Keep related writes atomic when partial completion would leave invalid state.
10. Wire the implementation where the module is composed. Use cases depend on the port, never on the concrete implementation.
11. Add a fake implementation for use-case tests and integration tests for the real implementation against a test database. See [`testing.md`](../rules/testing.md).

## Done when

- [ ] No ORM or database-specific types appear in `domain/` or `application/`.
- [ ] Persistence errors are mapped inside infrastructure.
- [ ] Queries enforce the data-access scope required by the domain.
- [ ] List queries are bounded and use appropriate ordering.
- [ ] The repository has a fake for use-case tests and integration tests for its real implementation.
- [ ] Transactions and database constraints protect relevant invariants.
