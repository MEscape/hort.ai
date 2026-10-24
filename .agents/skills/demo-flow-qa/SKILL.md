---
name: demo-flow-qa
description: Use when a user-facing feature is finished, before a demo or merge in HortAi. Walks the real demo path in a browser on desktop and mobile, in German and English, and reports bugs with reproduction steps and evidence.
---

# Demo Flow QA

Tests prove units; the jury sees the running app. Before a feature counts as done, click through the path a parent or child will actually take, the way the demo will show it.

## Setup

```bash
docker compose --env-file .env.docker up -d --wait postgres redis-rest mailpit azurite
docker compose --env-file .env.docker run --rm azurite-init
npm run db:migrate && npm run db:seed
npm run dev   # http://localhost:3000
```

Use a browser automation tool if your agent has one (Playwright, a browser MCP, or similar), otherwise ask a human to drive and report what they see. Use only seed or test accounts; never real child data. Emails land in Mailpit.

## The pass

Write the demo path down first as numbered steps (for example: parent signs up, verifies email, sets up the child, child starts a homework task, talks to the companion). Then, for each step:

1. **Happy path** on desktop (about 1440 px wide) and mobile (about 390 x 844).
2. **Both locales:** switch between `/de` and `/en`. Look for untranslated keys, English in the German UI, broken placeholders, text overflow from longer German words.
3. **Unhappy paths:** empty input, invalid input, double submit, back button, reload mid-flow, signed-out access to a protected page, slow or failed external service (voice, AI, storage).
4. **States:** loading, empty, error and success states exist and are understandable for the audience (a primary-school child must understand the child screens without reading much).
5. **Console and network:** no errors in the browser console, no failed requests, no secrets or personal data in responses or logs.
6. **Accessibility basics:** keyboard-only path works, visible focus, labels on inputs, sufficient contrast, touch targets on mobile.
7. **Product guardrails:** the companion never gives away the solution; no points, streaks or other gamification; only the child data the feature needs.

Take a screenshot of every finding and of the final state of each step.

## Report

```text
## Demo flow: <name> - <date> - <branch/commit>
Result: ready | ready with known issues | not ready

| # | Severity | Step | Viewport/locale | What happens | Expected | Evidence |
```

Severity: **blocker** (demo breaks), **major** (visible to the jury), **minor** (polish). Turn every blocker and major into a failing test or an issue before fixing it, then re-run the affected steps.
