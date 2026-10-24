# Alexa voice channel (Development stage only)

`POST /api/alexa` makes Alexa a second channel onto hort.ai's tutor: the child speaks, Alexa transcribes,
this endpoint hands the free text to the tutor and reads the tutor's answer back in Alexa's standard voice.
Alexa holds **no learning logic**. Today a connection-test stub answers every turn with
`Lennart wann holen wir uns draußen Suppe` and ends the session.

## Architecture

```text
Echo / simulator ─HTTPS─▶ src/app/api/alexa/route.ts            (framework entry, public + signed)
                           └─ modules/alexa/composition.ts       (wiring: skill id, verifier, tutor adapter)
                               ├─ infrastructure/ask-sdk/…       official ASK SDK signature + timestamp verifiers
                               ├─ presentation/routes.ts         Alexa JSON ⇄ TutorTurn / TutorReply, skill-id check
                               └─ domain/ports/tutor-conversation.port.ts   ◀── the only seam to the tutor
                                    implemented today by infrastructure/connection-test/connection-test-tutor.ts (stub)
```

The port is channel-neutral:

| `TutorTurn` (in) | meaning                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `conversationId` | branded `ConversationId`; Alexa's ephemeral session id (never a user/device id) |
| `utterance`      | the child's words as free text; `null` when the skill is opened ("öffne hort")  |
| `locale`         | `de-DE`                                                                         |

| `TutorReply` (out) | meaning                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `speech`           | plain text (no SSML), read in Alexa's standard voice                           |
| `conversation`     | `open`: Alexa keeps listening (with the same text as re-prompt); `closed`: end |

`respond(turn)` returns `AppResultAsync<TutorReply>`. An error is spoken as a short apology and ends the session;
Alexa still gets HTTP 200.

The channel handles only channel matters itself: Stop/Cancel/Home ("Tschüss"), Help, and "nothing understood"
(`AMAZON.FallbackIntent` or an empty slot). Everything the child says otherwise reaches the tutor.

## Connecting your tutor use case

1. Build the tutor as its own module with a channel-neutral use case, e.g. `RespondToChild` taking
   `{ conversationId, utterance | null, locale }` and returning `{ speech, conversation: 'open' | 'closed' }`.
   The web UI calls the same use case; there is one logic and two channels.
2. Export the use case from the tutor module's `index.ts`.
3. Add an adapter in `src/modules/alexa/infrastructure/tutor/` that implements `TutorConversation` by calling the
   tutor module's public API (the documented cross-module path; never deep-import another module).
4. Swap `connectionTestTutor` for that adapter in `src/modules/alexa/composition.ts`. Nothing else changes.
5. Keep conversation state on the tutor side, keyed by `conversationId`; Alexa sends no history. A session ends
   when the child stays silent after the re-prompt or says "stopp"; the next "öffne hort" is a new conversation.
6. Answer within the time budget below; return plain text without markup, emojis or links.
7. Put the rate limit into the tutor use case (it is the public, cost-incurring operation): a global and/or
   per-`conversationId` budget. Not per client address: all Alexa traffic arrives from a few Amazon addresses.
   A refusal comes back as an error and is spoken as the short apology. The endpoint itself has no budget yet;
   unsigned or forged requests stop at the timestamp/signature checks before any tutor work.

## Interaction model

`alexa/skill-package/interactionModels/custom/de-DE.json` (invocation name `hort`):

- `FreieEingabeIntent` with slot `eingabe` of the custom type `FREITEXT`: a catch-all. Its sample values only
  teach the recogniser what typical child input sounds like; Alexa passes on whatever was said. Samples are
  `{eingabe}` alone plus a few carrier phrases ("die antwort ist {eingabe}", "ich habe eine frage {eingabe}").
  Chosen over `AMAZON.SearchQuery` because SearchQuery cannot stand alone in a sample (a carrier phrase is
  mandatory), which would not fit bare answers such as "neun".
- Built-ins: Stop, Cancel, Help, NavigateHome, Fallback.

The model in the repository is the one imported in the Developer Console. Change both together.

## Environment

| Name             | Required | Notes                                                               |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `ALEXA_SKILL_ID` | yes      | `amzn1.ask.skill.…` from the console. Unset → endpoint answers 503. |

The skill id is not a secret, but it is environment-specific and therefore not committed.

## Developer Console (Custom skill, Provision your own)

1. Create Skill → name `hort.ai`, primary locale **German (DE)**, model **Custom**, hosting **Provision your own**,
   template **Start from Scratch**.
2. Build → Interaction Model → JSON Editor → paste `de-DE.json` → Save → Build skill.
3. Build → Endpoint → **HTTPS** → default region `https://<host>/api/alexa`; certificate type "My development
   endpoint is a sub-domain of a domain that has a wildcard certificate" for `*.trycloudflare.com` and
   `*.vercel.app` hosts (trusted CA otherwise) → Save.
4. Copy the Skill ID into `ALEXA_SKILL_ID` and redeploy/restart. Before that every real request is rejected
   (503 unset / 403 wrong skill), so the simulator only works after this step.
5. Test → "Skill testing is enabled in: **Development**" (check after every model build; it has been seen on
   "Off" before) → simulator `öffne hort`.
6. Echo: registered to the developer account, device language German. Say **„Alexa, öffne hort“**.
   Do not submit for certification or publish.

## Hosting

- Today: a cloudflared Quick Tunnel to a small Node host on the Hermes VM. Its URL is **ephemeral**: a restart of
  the tunnel yields a new URL that must be entered in the console (step 3). `skill.json` records the current one.
- Target: the Vercel deployment (`https://<project>.vercel.app/api/alexa`) with `ALEXA_SKILL_ID` set there.
  Switch the console endpoint only after the simulator answers through Vercel. Preview deployments are behind
  Vercel Authentication (401 "Protected deployment"), so Alexa cannot reach them; only an unprotected deployment works.

## Known limits

- **8-second answer limit.** Alexa abandons a request after 8 s. Measured today: ~0.4 s for the first request
  after a (re)start (certificate download from Amazon's S3, cached per certificate URL afterwards), 1–3 ms warm,
  plus ~0.1 s tunnel. A 5.3 s outlier coincided with heavy memory pressure and swapping on the host; the host
  process now runs without swap. An LLM tutor must stay well below 8 s end-to-end including a cold start
  on Vercel; for longer work send an Alexa **Progressive Response** ("Moment, ich überlege…") first and keep the
  final answer under the limit. Not built yet.
- **Voice only.** No photo/image input (homework photos stay a web feature); answers are read aloud, so no
  formulas, tables or long lists. Screens (Echo Show/APL) are not used.
- **Standard Alexa voice.** PlainText is spoken with Alexa's own voice. ElevenLabs tutor voices would need SSML
  `<audio>` with an HTTPS MP3 (≤ 240 s per response, special encoding) generated within the 8 s budget; not
  coupled, a separate decision.
- **Children's policy.** Development stage only; no publication, distribution or certification. No account
  linking, no persistent coupling between an Alexa account/device and a child, no personal data of children;
  the demo uses a fixed demo profile on the tutor side. A pairing code would be such a coupling and needs its
  own review. `isChildDirected` in `skill.json` must be revisited before any distribution.

## Known security exception

`ask-sdk-express-adapter` (official verifiers, required by the security brief) depends on `node-forge`, which
has advisory **GHSA-86w9-cpqp-85rv** (RSA PKCS#1 v1.5 signature verification, `<= 1.4.0`, no patched release).
node-forge is used only for the certificate-chain check of Amazon's signing certificate, whose URL is pinned to
`https://s3.amazonaws.com/echo.api/`; the request signature itself is verified with `node:crypto`. The advisory is
accepted as a reviewed, time-boxed exception until **2027-01-24** (decision B S, 2026-10-24). The repository
currently has no automated dependency audit (GitHub Actions were replaced by the Vercel build pipeline), so
`npm audit --omit=dev` reports exactly this one high advisory and nothing enforces the date; if an audit gate is
reintroduced, allow only `GHSA-86w9-cpqp-85rv` and only until that date. Exit: a patched node-forge or SDK
release, or replacing the SDK verifier with a `node:crypto` certificate-chain check.
