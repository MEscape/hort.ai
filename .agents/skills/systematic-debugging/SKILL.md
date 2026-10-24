---
name: systematic-debugging
description: Use when a test fails, the build breaks, CI is red or the app misbehaves in HortAi. Find the root cause with evidence before changing any code; no guess-and-check fixes.
---

# Systematic Debugging

No fix without a root cause. A fix you cannot explain is a guess, and guesses create the next bug.

The owning convention is [`docs/conventions/fixing-a-bug.md`](../../../docs/conventions/fixing-a-bug.md). This skill is how you get to step 1 of it.

## Phase 1: Observe

1. **Read the whole error.** Stack trace, file, line, error `kind` of the neverthrow result, the first failing assertion. The first error matters most; later ones are often consequences.
2. **Reproduce reliably.** Narrowest command that shows it: one Vitest file, one route, one click path. If it is flaky, find the variable (time, order, shared state, locale, env) before anything else.
3. **Check what changed.** `git diff`, `git log -5`, a dependency bump, a new env variable (`.env.example`), a migration that was not applied (`npm run db:migrate:status`), docker services not running.

## Phase 2: Locate

1. **Trace the data backwards** from the symptom to where the value first becomes wrong: presentation → action → use case → port → adapter. In this architecture the fault usually sits at one boundary: Zod schema, mapper, adapter, or a missing authorization/tenant check.
2. **Compare with a working example.** The `auth` and `audit` modules are the reference implementations. What does the working path do that the broken one does not?
3. **Check the version-specific docs.** Next.js 16, React 19 and Prisma 8 differ from what models remember. Read `node_modules/next/dist/docs/` and the installed package types before assuming an API.

## Phase 3: Hypothesis

State one hypothesis: "X fails because Y, visible in Z." Test it with the smallest experiment: one log line, one assertion, one input. Change one variable at a time. If it is wrong, form a new hypothesis; do not stack fixes.

## Phase 4: Fix

1. Write a failing test that reproduces the bug at the layer that owns the fault (see the `test-driven-development` skill).
2. Fix the cause, in the owning layer. Do not patch the symptom in a higher layer and do not weaken a lint rule, architecture test or type to get green.
3. Re-run the test, then `npm run check`.
4. Search for the same faulty pattern elsewhere (`jg` if available, otherwise a narrow search) and fix or list the other instances.

## Stop rule

After **three failed fix attempts**, stop. The problem is architectural or your model of the system is wrong. Write down what you tried and what you observed, and ask the user or re-plan instead of trying a fourth variation.

## Red flags

- "Let me just try this" without a hypothesis.
- Several changes at once, then "it works now".
- Disabling a test, rule or check to make the failure go away.
- Fixing CI by editing the workflow when the code is wrong.
- Reporting "fixed" without having re-run the failing command.
