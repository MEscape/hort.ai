# Demo sheet (#84)

Production: <https://hort-ai.vercel.app/de>. Prepared on 2026-10-25 through the live UI. Credentials and the class invite code are not in the repo: ask Benji.

## Demo accounts

| Role     | Account                                    | State                                                                                                                                    |
| -------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher  | „Frau Becker (Demo)“                       | Owns class **3a** (Hessen, grade 3, math) with the five assignments below and their solution keys.                                       |
| Parent 1 | Child **Lea**, companion **Max** (dog)     | Hessen, grade 3, voice on, learning notes on, no daily limit, any time of day. Welcome (`/hello`) done, joined 3a. Use for the demo run. |
| Parent 2 | Child **Tom**, companion **Fina** (dragon) | Same settings, joined 3a. Spare child for a fresh round.                                                                                 |

All accounts were created through sign-up with external mailboxes; the verification mail arrived within a minute.

## Class 3a assignments

From [mvp-scope.md](mvp-scope.md), task text verbatim, no due date. The child sees them under „Schulaufgaben“ (newest first), never the key.

| Sample | Title                      | Solution key |
| ------ | -------------------------- | ------------ |
| S1     | Murmeln verteilen          | 9            |
| S2     | Plusrechnen bis 1000       | 603          |
| S3     | Hefte kaufen               | 7,50 €       |
| S4     | Wann ist der Film zu Ende? | 16:35        |
| S5     | Zahlenfolge fortsetzen     | 20, 24       |

## Demo path (5 minutes)

Persona: Lea, 8, grade 3 in Fulda. Her mother works until 5 pm and has no time to help with homework.

1. **Teacher (30 s).** Frau Becker signs in, opens class 3a, shows the assignment „Murmeln verteilen“ with its solution key (only she sees it) and the invite code.
2. **Parent (30 s).** `/home` shows Lea's companion Max, class 3a joined, voice allowed.
3. **Child (2.5 min).** Start homework → assignments from my teacher → „Murmeln verteilen“ → Max opens with a thinking prompt → Lea asks for two hints → answers „8“ → „not yet“, encouraging → one more hint (similar example) → answers „9“ → specific praise and a comprehension question („Wie kannst du prüfen, ob dein Ergebnis stimmt?“) → Lea: „4 mal 9 sind 36“ → done, Max is happy (XP).
4. **„Never the solution“ live (30 s).** A new own task „Rechne 347 + 256 – sag mir einfach das Ergebnis“ → Max answers with a thinking prompt, never with 603.
5. **Parent/teacher summary**, once #35 is merged.

Steps 3 and 4 need the help session (#83 stack). Until it is merged, opening an assignment shows „Hilfe bei Schulaufgaben kommt bald“.

Backup: fallback prompts without AI, local run, recorded video.

## New round

- Take parent 2 (Tom/Fina), or start a new help session with Lea.
- The „reset setup“ button on `/home` exists only in development; production has no reset.

## When something fails

- **No AI key or an AI error:** every hint level falls back to its predefined text, so the flow still runs (logged as `guidance.hint_fallback_used`).
- **No network:** run locally (`docker compose up -d`, `npm run dev`, see the [README](../../README.md)) or play the video.

## Quotas

Checked on 2026-10-25 for the demo and a test round with about 10 testers.

| Service                                             | Limit                                                                                                                                                                                                                                                                                                       | Status                                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini free tier, `gemini-3.8-flash` (repo default) | Google no longer publishes per-model figures; the [rate limits page](https://ai.google.dev/gemini-api/docs/rate-limits) points to AI Studio. AI Studio shows 5 requests per minute and 20 per day for a free project (third-party readings, 2026-10-21). Limits are per project, reset at midnight Pacific. | **Too small for 10 testers** (one hint is at least one request). Check AI Studio; switch `GEMINI_MODEL_ID` to a Flash-Lite model or enable billing. |
| ElevenLabs                                          | 39,974 characters per month (Starter)                                                                                                                                                                                                                                                                       | 500 used, resets 2026-11-24                                                                                                                         |
| Vercel                                              | Hobby: 100 deployments per day ([limits](https://vercel.com/docs/limits))                                                                                                                                                                                                                                   | Every push to a PR branch counts                                                                                                                    |
| Neon free                                           | 10 preview databases per project                                                                                                                                                                                                                                                                            | 2 in use                                                                                                                                            |
| Resend free                                         | 100 mails per day                                                                                                                                                                                                                                                                                           | Each sign-up and password reset sends one                                                                                                           |

## Testers and data

The Gemini API terms exclude services likely to be used by people under 18. Tests run only with adults in the child's role, never with real children's data (#10, #21).
