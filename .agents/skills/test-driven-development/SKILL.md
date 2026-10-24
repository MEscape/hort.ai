---
name: test-driven-development
description: Use when implementing a feature, fixing a bug or changing behavior in HortAi. Enforces red-green-refactor with Vitest, port fakes and neverthrow results before any production code.
---

# Test-Driven Development

Write the test first. Watch it fail for the right reason. Write the least code that makes it pass. Then clean up.

If you did not see the test fail, you do not know that it tests anything.

The owning rules are [`docs/rules/testing.md`](../../../docs/rules/testing.md) and [`docs/conventions/fixing-a-bug.md`](../../../docs/conventions/fixing-a-bug.md). This skill is the working loop; those documents win on any conflict.

## When

Always for new behavior, bug fixes and behavior-changing refactors. Exceptions only with the user's explicit agreement: throwaway spikes (see the `writing-plans` skill), generated code, pure configuration.

## The loop

### 1. RED: one failing test for one behavior

Pick the lowest layer that owns the behavior:

| Behavior lives in                 | Test it as                                                      | Example in the repo                                             |
| --------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Domain rule, value object, policy | Plain unit test, no fakes                                       | `__tests__/src/modules/auth/domain/*.test.ts`                   |
| Use case (`application/`)         | Unit test with **port fakes** from the module's `fakes.ts`      | `__tests__/src/modules/auth/application/sign-up.test.ts`        |
| Adapter (`infrastructure/`)       | Against its real contract; DB work as `*.integration.test.ts`   | `__tests__/src/modules/audit/infrastructure/`                   |
| Zod schema                        | At the boundary: valid, invalid, edge input                     | `__tests__/src/modules/auth/presentation/schemas.test.ts`       |
| Server Action                     | Through its observable result                                   | `__tests__/src/modules/auth/presentation/actions.test.ts`       |
| Client Component                  | Testing Library, query by role and accessible name, real clicks | `__tests__/src/modules/auth/presentation/sign-in-form.test.tsx` |

Good tests here:

- Name states the behavior in plain words (`'refuses a password below the minimum before anything else happens'`). An "and" in the name means two tests.
- Build the system under test with a small `build(overrides)` helper and fakes that **record what happened** (`recordingAudit().events`, `fakeAuthenticator().calls`). Assert outcomes and recorded effects, not call counts.
- Assert neverthrow results explicitly: `expect(result.isErr() && result.error).toMatchObject({ kind: 'validation', ... })`.
- Deterministic: inject clocks and randomness, no shared state, no order dependence.
- Never mock the system under test. Do not test what Next.js or Prisma own.

### 2. Verify RED (mandatory)

Run only that file:

```bash
npx vitest run __tests__/src/modules/<module>/<layer>/<file>.test.ts
npm run test:integration -- <path>   # for *.integration.test.ts (needs the docker services)
```

Confirm the test **fails**, not errors, and fails because the behavior is missing. A type error or a missing fake method is a harness problem: fix it until the failure is about the product. A test that passes immediately tests existing behavior or the wrong thing; rewrite it.

### 3. GREEN: the least code that passes

Hardcoding and duplication are fine at this step. Put the code in the layer that owns it and respect module boundaries (`docs/rules/boundaries.md`). No extra features, logging or "while I'm here" refactors. Use the generators (`npm run gen`) for new modules, use cases, components and translations instead of hand-writing scaffolding.

### 4. Verify GREEN (mandatory)

Re-run the file, then the narrowest wider scope (`npm test`, `npm run test:architecture` when you touched structure). Output must be clean: no new warnings, no unexpected `console.error`. If a test fails, fix the code, not the test.

### 5. REFACTOR

Only on green. Remove duplication, improve names, extract helpers. Re-run after each step. A red test during refactoring means undo and take a smaller step.

### 6. Repeat, then finish

Next behavior, next cycle. Before calling the work done run `npm run check` (typecheck, lint, format, i18n, dead code, integration, coverage, architecture, scripts). Report what actually ran. Never claim a check passed that you did not run.

## Red flags: stop and restart the cycle

- Production code written before its test.
- A test that passed on its first run.
- You cannot say why the test failed.
- "Too simple to test", "I'll add tests after", "I tested it manually".
- Mocking everything: the design is too coupled, introduce or use a port.

## Bug fixes

Reproduce the bug as a failing test at the layer that owns the fault, then follow the loop. The test is the proof that the fix works and stays fixed. Pair with the `systematic-debugging` skill when the cause is unclear.

## Done when

- [ ] Every changed behavior has a test that was seen failing first.
- [ ] Error paths and edge cases are covered, not only the happy path.
- [ ] Tests use fakes for ports, never mocks of the code under test.
- [ ] `npm run check` was run and its real result is reported.
