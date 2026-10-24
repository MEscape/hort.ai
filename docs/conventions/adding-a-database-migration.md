# Adding a Database Migration

Owning rules: [`persistence.md`](../rules/persistence.md), [`boundaries.md`](../rules/boundaries.md), [`testing.md`](../rules/testing.md).

Generator: none; `npm run gen -- module` prints the Prisma model to add, `npm run db:generate` emits the contract ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Identify the schema change required by the feature. Update `schema.prisma` when using Prisma, and keep persistence-specific concerns in the infrastructure layer.
2. Generate a migration using the project's established workflow. For a standard Prisma development workflow, use `npx prisma migrate dev --name <slug>`. Review the generated SQL before proceeding.
3. Check for destructive changes, including dropped columns, renamed columns, type changes, and new `NOT NULL` constraints. Preserve existing data where required. Use staged migrations for changes that need a backfill or a compatibility period.
4. Choose appropriate database types. Store timestamps consistently, normally in UTC. Represent money using integer minor units or a suitable decimal type; avoid floating-point types for exact monetary values. See [`persistence.md`](../rules/persistence.md).
5. Add database constraints for invariants that the database can enforce, including uniqueness, referential integrity, valid ranges, and required relationships. Add indexes for known query patterns, considering their write and storage costs.
6. Keep database constraints consistent with domain rules. Application validation and authorization are still required where appropriate; a database constraint does not replace them.
7. Update repository queries, persistence mappings, and affected domain models to reflect the schema change. Do not expose ORM-specific types beyond the persistence boundary.
8. Consider existing data, concurrent writes, locking, table size, and deployment order. For changes that cannot be applied safely in one step, use an expand-and-contract approach: introduce a compatible schema, migrate or backfill data, update consumers, and remove obsolete structures in a later migration.
9. Add or update tests for the changed persistence behavior. Include integration tests when the behavior depends on actual database constraints, transactions, indexes, or migrations.
10. Run the project's database validation, code generation, lint, type-check, and relevant test commands. Verify that a fresh database can be created from the committed migrations.
11. Commit the migration with the code change that requires it. Never edit a migration that has already been applied in a shared environment; create a new migration instead.

## Database design checks

When adding or changing a table or column, consider the following:

- **Data ownership and access scope.** Model ownership and relationships explicitly. Where the application supports multiple tenants or accounts, enforce the required isolation in queries and, where appropriate, database constraints. Do not introduce tenant-specific columns or relationships unless the domain requires them.
- **Referential integrity.** Define foreign keys and appropriate deletion behavior. Avoid orphaned records and relationships that permit invalid states.
- **Domain invariants.** Use `NOT NULL`, unique constraints, check constraints, and foreign keys where they accurately represent the intended invariant. Keep validation in the domain or application layer where the rule requires business context.
- **Closed sets of values.** Use database enums or other constrained representations when appropriate for the domain and supported by the project's schema tooling. Keep the database representation aligned with application types.
- **Timestamps.** Decide how creation and update timestamps are maintained. Use the project's established mechanism, such as application-managed timestamps or database defaults and triggers. Do not assume a trigger exists unless the project configures one.
- **Indexes.** Add indexes based on actual query patterns and constraints. Check whether an existing primary-key, unique, or foreign-key index already covers the access path before adding another.
- **Database-specific features.** For features the schema language cannot express, use the project's documented mechanism for raw SQL or custom migration operations. Ensure these operations are reproducible and included in migration validation.
- **Migration safety.** Consider deployment order, rollback or recovery strategy, lock duration, and compatibility between the old and new application versions.
- **Environment safety.** Run migrations against the intended development or test database. Never run destructive migration experiments against production data.

## Done when

- [ ] The migration has been generated and its SQL reviewed.
- [ ] Existing data and destructive changes have been accounted for.
- [ ] Constraints and indexes reflect the intended data model and query patterns.
- [ ] Repository mappings and affected application or domain code are updated.
- [ ] Relevant migration and persistence tests pass.
- [ ] A fresh database can be initialized from the committed migrations.
- [ ] The migration is committed with the code change that requires it.
