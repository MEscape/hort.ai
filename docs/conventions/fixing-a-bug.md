# Fixing a Bug

Owning rules: [`testing.md`](../rules/testing.md), [`errors.md`](../rules/errors.md), [`observability.md`](../rules/observability.md).

Generator: none ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Reproduce the bug. Write a failing test at the lowest layer where the fault occurs: domain, use case, adapter, or UI.
2. Identify the layer that owns the fault. Fix it there rather than adding a workaround in a higher layer.
3. Do not patch over an architectural violation. If the cause is a boundary breach, fix the boundary itself. See [`boundaries.md`](../rules/boundaries.md).
4. Make the test pass with the smallest change that addresses the underlying cause, not merely the observed symptom.
5. Check whether the failure was silent or difficult to diagnose. If so, add an appropriate typed error or structured log at the relevant boundary. See [`observability.md`](../rules/observability.md).
6. Search for the same faulty pattern elsewhere. Fix other affected instances or explicitly document the remaining scope.
7. If the bug exposes a missing or unclear rule, update the owning rule file in the same change.

## Done when

- [ ] A test reproduces the bug before the fix and passes afterward.
- [ ] The fix is in the layer that owns the fault.
- [ ] The underlying cause is addressed rather than hidden by a workaround.
- [ ] No new architectural boundary violation is introduced.
- [ ] Relevant observability and documentation are updated where needed.
