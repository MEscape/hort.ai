---
name: writing-plans
description: Use when starting a feature, issue or multi-file change in HortAi, especially when several people or agents work in parallel. Produces a short plan with decisions, file ownership, test-first tasks and a time-boxed spike when something is unknown.
---

# Writing Plans

A plan is cheap; a wrong afternoon in a hackathon is not. Plan before code whenever the change touches more than one layer, more than a handful of files, or files other people are working on.

## 1. Pin the goal

- What does the user, child or parent see when this works? One or two sentences.
- Acceptance criteria as observable behavior. These become the first tests.
- What is explicitly **out of scope**.
- Product guardrails that apply (check `docs/product/` and the issue): for HortAi the companion guides children towards their own answer and never gives the solution, and there are no streaks or pressure mechanics (only the small progression of the vision).

## 2. Decide before building

List open decisions and settle them first: data model, which module owns it, which port, which existing component. Prefer what the repo already has: module conventions (`docs/conventions/adding-a-module.md`, `adding-a-use-case.md`, ...), generators (`npm run gen`), shared libs in `src/lib/README.md`. A decision that changes architecture, dependencies or another person's module needs a quick yes from its owner before work starts.

## 3. Spike unknowns, time-boxed

If feasibility is unclear (an external API, a voice provider, a library on this Next.js version), run a spike first:

- Fixed time box (30 to 60 minutes) and one question it must answer.
- Throwaway code on a scratch branch, never merged.
- Output: a yes/no plus the facts that matter (latency, limits, the API shape). Then plan the real work with TDD.

## 4. Split into small tasks

Each task is 15 to 60 minutes, independently verifiable, and lists:

- **Files** it creates or changes (exact paths).
- **Test first:** the failing test that proves it (file path and behavior).
- **Done when:** the command that shows it works.

Order tasks so the demo path works end to end as early as possible, then deepen. Keep the app shippable after every task.

## 5. Ownership against merge conflicts

When people or agents work in parallel:

- Assign each task an owner and its files. Two owners never edit the same file in the same round.
- Shared hot spots (`prisma/schema.prisma`, migrations, i18n catalogs, `package.json`, `AGENTS.md`) get one owner per round or a short serial slot.
- Branch per task from a fresh base, small PRs, merge often.

## Plan template

```markdown
## Goal

## Acceptance criteria

- [ ] ...

## Out of scope

## Decisions (with owner)

## Spike (if any): question, time box, result

## Tasks

1. <title> (owner) - files: ... - test first: ... - done when: ...
```

Keep the plan in the issue or PR description, not in a new tracking file.
