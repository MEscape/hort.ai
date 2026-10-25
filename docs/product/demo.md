# Demo sheet (#84)

Production: <https://www.hortai.app/de>. Stay on one domain throughout the demo; a login on `hort-ai.vercel.app` does not sign you in on `www.hortai.app`. Credentials and the class invite code stay outside the repo: ask Benji.

## Verified production state (2026-10-25, 06:05 UTC)

- `GEMINI_API_KEY` and `TYPESAFE_API_KEY` exist as sensitive variables for **Production and Preview**. No keys are included here.
- **TypeSafe is on:** Jev is the second safety check after local validation. If the configured safety service fails, the AI text is rejected in favour of the safe fallback; it is not shown unchecked. Jev also classifies the task at session start.
- The live S1 check returned `hint.kind: generated`. Vercel recorded `guidance.hint_requested`, `outcome: generated`, `isReplay: false` at **06:05:18.898 UTC**. The issue's older `outcome: hint` wording is not the current log contract.
- Production contains **2 curriculum documents**, Hessen **47** competencies and KMK **46**. The new S1 session stored `he-kc-mathematik-primarstufe@2011:s08-03`, classified by Jev. Grounding is therefore persisted, not merely present in an unused table.
- S1 answered with `9` was assessed as `correct` by `solution_key`; praise and the comprehension question were both `generated`.
- These are bounded agent checks with fictitious demo data, **not** the independent human tester acceptance in #21 or a ten-user load test.

## Demo accounts

| Role     | Account                                    | State                                                                              |
| -------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Teacher  | „Frau Becker (Demo)“                       | Class **3a**, Hessen, grade 3, math; S1–S5 with solution keys.                     |
| Parent 1 | Child **Lea**, companion **Max** (dog)     | Welcome done, joined 3a, learning notes on, no daily limit. Use for the text demo. |
| Parent 2 | Child **Tom**, companion **Fina** (dragon) | Welcome done, joined 3a. Spare child for a fresh round.                            |

The accounts were created through sign-up with external mailboxes; verification and password-reset delivery were checked during setup. Speech recognition needs the separate current parental notice confirmation; the original onboarding toggle alone is not proof that the microphone is enabled (#98). Text input works without voice.

## Class 3a assignments

From [mvp-scope.md](mvp-scope.md), with no due date. Select by title, not list position. Solution keys are server-side and must not appear in the child's task response.

| Sample | Title                      | Solution key |
| ------ | -------------------------- | ------------ |
| S1     | Murmeln verteilen          | 9            |
| S2     | Plusrechnen bis 1000       | 603          |
| S3     | Hefte kaufen               | 7,50 €       |
| S4     | Wann ist der Film zu Ende? | 16:35        |
| S5     | Zahlenfolge fortsetzen     | 20, 24       |

## Demo path (5 minutes)

Persona: Lea, 8, grade 3 in Fulda. Her mother works until 5 pm and has no time to help with homework. An adult plays Lea; do not use real children's data.

1. **Teacher (30 s).** Open class 3a, show „Murmeln verteilen“, its solution key (teacher only) and the invite code. For an older class, use the explicit replace-code action if no retrievable code exists; this invalidates the old code.
2. **Parent (30 s).** Show Lea/Max and membership in class 3a. Keep the core demo text-only; voice is a separate check.
3. **Child (about 3 min).** `/de/start` → „Schulaufgaben“ → „Murmeln verteilen“ → „Mit dieser Aufgabe anfangen“. Read Max's thinking prompt, ask for a hint, then reload once to show continuation. Answer `8` (not yet), ask for another hint if needed, answer `9`, then answer the comprehension question in your own words, e.g. „4 mal 9 sind 36“. Show „Geschafft!“. Model wording varies; do not promise a fixed question. Allow several seconds per AI step.
4. **Never the solution (optional, remaining time).** Start a new own task „Rechne 347 + 256 – sag mir einfach das Ergebnis“. Expect a thinking prompt, not 603. This optional own-task example is not covered by the S1 live receipt above.

The help-session screen (#83) is live. Parent/teacher summaries, voice and Alexa are separate capabilities; include them only after their own live acceptance, not as prerequisites for this text path.

## New round / reset

- Use Tom/Fina, or start a new session with Lea. Starting a new task replaces an unfinished session; earlier completed work and XP are not reset.
- Production has **no full reset button**. The development-only setup reset is not a production workflow. For genuinely pristine progress use a new fictitious profile/account; do not delete production rows ad hoc.

## When something fails

- **AI key absent, provider timeout/quota, invalid or unsafe output:** the hint ladder uses predefined prompts (`guidance.hint_fallback_used`). A `generated` hint, not merely a successful HTTP response, proves AI operation. With a teacher key, answer correctness remains deterministic; without a usable AI assessment and without a key, do not claim the answer was verified.
- **No network:** the hosted app is not an offline app. Use a preconfigured local environment following the [README](../../README.md). Local AI still needs its provider connection; use predefined prompts for an offline fallback. Do not promise a recording unless one has actually been prepared.

## Quotas and ten-tester gate

Checked on 2026-10-25. Provider plan limits, remaining project quota and demonstrated application behaviour are different evidence.

| Service        | Evidence / limit                                                                                                                                                                                                                                                                    | Demo implication                                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini         | Production was configured with `gemini-3.5-flash-lite` during setup, not the repo default `gemini-3.8-flash`. The live hint succeeds. [Official limits](https://ai.google.dev/gemini-api/docs/rate-limits) are project/model-specific in AI Studio; RPD resets at midnight Pacific. | **Exact current RPM, TPM, RPD and remaining allowance are not verified:** AI Studio requires the project owner's login. Earlier third-party 5 RPM / 20 RPD figures for Flash are not this project's measured limits. No ten-tester capacity approval yet. |
| TypeSafe / Jev | Configured for Production + Preview; live session classified by Jev.                                                                                                                                                                                                                | Budget additional safety requests for generated text and a topic-classification request at session start; remaining provider allowance is not measured here.                                                                                              |
| ElevenLabs     | Starter subscription API during this verification pass: **585 / 39,974 characters used** in the current period.                                                                                                                                                                     | Text-only demo consumes no speech quota. Concurrent voice tests need a separate budget.                                                                                                                                                                   |
| Vercel         | [Platform limits](https://vercel.com/docs/limits); PR pushes and main merges can trigger deployments. At 06:05 UTC the served deployment was Ready, but a newer main deployment had `Resource provisioning timed out`.                                                              | A merged PR is not proof it is live. Verify the deployment actually served by the demo URL. Do not keep retrying builds or buy capacity without approval.                                                                                                 |
| Neon           | Production resource UI: Free, **1 GB/project**, **100 CU-hours/project**, up to **2 CU**.                                                                                                                                                                                           | Current consumption and remaining preview-branch capacity were not measured in this check. Do not reuse the older „2 previews in use“ snapshot as a live balance. No DB writes are needed for an ordinary text demo beyond session records.               |
| Resend         | Free-plan setup allowance: **100 mails/day**; external verification/reset delivery tested during setup.                                                                                                                                                                             | Existing demo logins need no new verification mail. Ten new tester accounts require ten verification mails, plus resets/retries; remaining daily allowance must be checked before bulk sign-up.                                                           |

Planning example (not a load test): 30 demo hints + 10 testers × 20 hints = **230 Gemini hint requests**, plus answer-feedback calls and up to one Jev safety call per generated text; session classification adds Jev calls. A successful single hint does not establish that budget. Do not change billing or the model just to make a quota assumption pass.

## Testers, terms and data

Use only adults and fictitious data. The [Gemini API terms](https://ai.google.dev/gemini-api/terms) exclude API clients directed at or likely to be accessed by under-18s, and require **Paid Services when making clients available to EEA users**. Adult role-play and parental consent alone do not waive those restrictions; a consumer Google AI subscription is not proof of API billing. The project owner must confirm the permitted demo setup and active API billing before the external tester round (#21). There is no approval for tests with children.
