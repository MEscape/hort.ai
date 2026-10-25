---
name: code-review
description: Use when about to commit or open a PR, or when asked to review a diff or PR in HortAi. Runs the right review agents from docs/agents, checks the change against its goal and returns concrete, evidence-backed findings.
---

# Code Review

Review the change against what it was supposed to do, with evidence, before anyone else has to. The review specifications already exist in [`docs/agents/`](../../../docs/agents/README.md); this skill tells you which to run and how to report.

## 1. Get the real diff

```bash
git fetch origin
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
gh pr view <n> --json title,body,files && gh pr diff <n>   # when reviewing a PR
```

Read the issue or task and its acceptance criteria. Review the whole diff, not only the files you remember changing.

## 2. Pick the agents

Use the execution matrix in `docs/agents/README.md`. For a normal PR:

- **Always:** `test-agent.md` (Test / Regression) and `goal-checker-agent.md` (does it do what was asked, completely).
- **User-facing UI changed:** `designer-agent.md`.
- **Structure, shared code or dependencies changed:** `architecture-agent.md`.
- **Auth, sessions, tenants, input handling, secrets, child data:** `security-agent.md`, and `bug-bounty-agent.md` when abuse is plausible.

Follow each agent's method and output contract. When you can, run each agent in a fresh context (a subagent) so it is not biased by your implementation.

## 3. Checks that catch most hackathon bugs

- **Gates ran:** `npm run check` passed for real, or the failing part is named.
- **Tests:** new behavior has tests that would fail without it; no mocked system under test.
- **Boundaries:** business logic not in `src/app/`; no cross-module import around the public API; lint/architecture rules not disabled.
- **Trust boundary:** every external input validated with Zod; authentication, authorization and tenant/ownership scope enforced on server actions and route handlers.
- **Errors:** neverthrow results handled, nothing silently swallowed; user sees a translated message.
- **i18n:** no hard-coded UI strings; DE and EN both real translations, placeholders intact (`npm run i18n:check`).
- **Accessibility:** labels, roles, focus, keyboard path.
- **Product guardrails:** the companion never reveals the solution to the child; no streaks or pressure mechanics (only the small progression of the vision); minimal child data.
- **Secrets:** no keys, tokens or real personal data in code, fixtures, logs or screenshots.
- **Scope:** no unrelated refactors, files or dependencies (see the `lean-code` skill).

## 4. Report

One list, most severe first. Each finding:

```text
[blocker|major|minor] path/to/file.ts:42 - what is wrong - why it matters - concrete fix
```

Only report what you can point to in the diff or a command output. No generic style advice. End with a verdict: **approve**, **approve with minor fixes**, or **changes required**, and which checks you actually ran.

When posting to GitHub, use `gh pr review <n> --comment|--request-changes --body-file <file>`, and only when asked to post.
