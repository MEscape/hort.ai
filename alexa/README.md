# Alexa voice channel (Development stage only)

`POST /api/alexa` makes Alexa a second channel onto hort.ai's tutor: the child speaks, Alexa transcribes,
this endpoint hands the free text to the tutor and plays the tutor's answer in the tutor's own (ElevenLabs) voice,
falling back to Alexa's standard voice whenever that voice is not available in time.
Alexa holds **no learning logic**. Opening the skill lets every ready tutor introduce itself in its own voice
(see [Tutor voice](#tutor-voice)); today a connection-test stub answers every other turn with
`Lennart wann holen wir uns draußen Suppe` and ends the session.

## Architecture

```text
Echo / simulator ─HTTPS─▶ src/app/api/alexa/route.ts            (framework entry, public + signed)
                           └─ modules/alexa/composition.ts       (wiring: skill id, verifier, tutor adapter)
                               ├─ infrastructure/ask-sdk/…       official ASK SDK signature + timestamp verifiers
                               ├─ presentation/routes.ts         Alexa JSON ⇄ TutorTurn / TutorReply, skill-id check
                               ├─ domain/ports/tutor-conversation.port.ts   ◀── the only seam to the tutor
                               │    implemented today by infrastructure/connection-test/connection-test-tutor.ts (stub)
                               └─ domain/ports/tutor-voice.port.ts          ◀── the tutor's voice
                                    implemented by infrastructure/voice/voice-module-tutor-voice.ts → @modules/voice
```

The port is channel-neutral:

| `TutorTurn` (in) | meaning                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `conversationId` | branded `ConversationId`; Alexa's ephemeral session id (never a user/device id) |
| `utterance`      | the child's words as free text; `null` when the skill is opened ("öffne hort")  |
| `locale`         | `de-DE`                                                                         |

| `TutorReply` (out) | meaning                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `speech`           | plain text (no SSML), spoken in the tutor's voice (see below) or Alexa's voice |
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
   A refusal comes back as an error and is spoken as the short apology. Unsigned or forged requests never
   reach the tutor (see "Request verification").

## Request verification

`infrastructure/ask-sdk/ask-request-verifier.ts` wraps the official ASK SDK verifiers (no own certificate code)
in cheap guards that run first, so a forged request cannot make the server fetch certificates at will:

1. Timestamp within ±150 s of the server clock (the SDK alone only rejects old dates).
2. `SignatureCertChainUrl` of the form `https://s3.amazonaws.com/echo.api/echo-api-cert-<letters/digits>.pem` (today
   `echo-api-cert-EUAmazon-prod-…pem`): no query, fragment, port, encoding, host case variants or dot segments.
   The SDK caches certificates per URL string, so a certificate has exactly one cache key.
3. Download budget: a URL that has not yet verified a request costs a download from S3; such downloads run one at
   a time and at most 5 per 10 minutes per server instance. A URL that verified a request skips the budget.
   The download itself (`infrastructure/ask-sdk/cert-chain-download.ts`) replaces only the SDK's transport, whose
   `https.get` has no timeout: `fetch` with `AbortSignal.timeout(3 s)` for connect, headers and body together,
   no redirects, at most 64 KiB (Content-Length checked first, then bytes counted while reading; the read stops at
   the limit). On timeout or overflow the request is aborted (socket closed) and the slot is free again.
4. Then the SDK: timestamp verifier, certificate chain, signature (`Signature-256`), and finally the skill id.

If Amazon rotates its certificate while an attacker keeps the budget exhausted, real requests fail until the
window passes (at most 10 minutes); that trades availability for a hard cap on outbound downloads.

## Tutor voice

**Launch:** when the skill opens, every tutor with status `bereit` in the tutors catalog introduces itself in
catalog order (today Max, Lili, Fina) with its catalog greeting (`begruessung`), each in its own ElevenLabs voice:
one APLA document whose main template is a `Sequencer` of one `Audio` component per tutor. The clips are fetched
in parallel under the same 4 s deadline (the clip cache below makes every launch after the first a cache hit).
A tutor whose clip fails or is late is spoken as an APLA `Speech` component with the same text (Alexa's voice);
the others keep their own voice. Without any clip (or with `ALEXA_TUTOR_VOICE=false`) the greetings are one
PlainText answer. The session then ends, as before. The launch no longer reaches the tutor stub, so the
connection-test sentence is only the answer to free input. Greetings come from
`infrastructure/tutors/catalog-tutor-introductions.ts` (`@modules/tutors`); the voice is asked through the
`TutorVoice` port (`greetingUrl`, a hosted `phrase: 'greeting'` of the voice module).

**Replies:** a successful tutor reply is played as an audio clip in a tutor's ElevenLabs voice (`ALEXA_TUTOR_ID`,
default `max`, the dog), via an **APL for Audio** directive (`Alexa.Presentation.APLA.RenderDocument`, one `Audio`
component). Channel phrases (Tschüss, help, not understood) and the failure apology stay in Alexa's voice.

1. `voice-module-tutor-voice.ts` calls `getHostedSpeech()` from `@modules/voice` (the channel never calls
   ElevenLabs). The voice module keys a clip by a SHA-256 of voice and text, looks it up in the **private**
   storage container (`speech-clips/<hash>.mp3`), synthesizes and uploads only on a miss (global budget
   `voice.hosted-synthesize`, 60 per 10 minutes) and returns a **15-minute read-only SAS URL**. A fixed sentence
   is therefore synthesized once; every later answer is a HEAD plus a local signature. Concurrent misses of the
   same clip share one synthesis (single flight per server instance).
2. `routes.ts` waits at most **4 s** for that URL (`withTimeout`), then answers with plain text instead. Any error
   (no key, no storage, unknown tutor, budget spent, provider or upload failure, timeout) has the same outcome:
   Alexa's voice, HTTP 200. Only the reason code is logged (`Alexa tutor voice unavailable`), never text or URL.
3. Format: ElevenLabs `mp3_44100_128` is played as is (APLA allows MP3 up to 48 kHz; SSML `<audio>` would need
   48 kbps / ≤24 kHz and a transcode). An open conversation re-prompts with the same text in Alexa's voice.
4. APLA plays on every Alexa device and needs **no interface in the console or manifest**; Alexa does not list it
   in `supportedInterfaces` (checked in the simulator), so there is no per-device check. Alexa reports a clip it
   could not play with `Alexa.Presentation.APLA.RuntimeError`; the endpoint acknowledges it (empty response) and
   logs `apla_runtime_error`.
5. Amazon requires `Access-Control-Allow-Origin: *` on APLA audio URLs
   ([URL requirements](https://developer.amazon.com/en-US/docs/alexa/alexa-presentation-language/apla-audio.html#url-requirements)).
   The Blob service of both storage accounts (`sthortaiprod95af81`, `sthortaiprev95af81`) therefore has a second
   CORS rule: origins `*`, methods `GET`/`HEAD` only, max age 3600 s. It follows the existing `*.vercel.app` /
   localhost rule (which keeps answering with its own origin). Access still needs the SAS; a write preflight from a
   foreign origin is refused (403). Read it back with
   `az storage account blob-service-properties show … --query cors`; a new account needs the same rule.

Content rule: clips are fetched by Amazon from a public (signed) URL, so they must never contain data about a
child. Today only fixed text is voiced: the reviewed channel sentences of `channel-lines.json` and the catalog
greetings; the voice module refuses any other text. Dynamic, child-related answers (generated tutor replies)
must not be voiced on this path at all: they need a validated, user-bound consent/ticket path first (an
authenticated actor whose consent covers the Alexa channel, and a server-issued ticket for the validated reply,
as the web voice uses). Filtering names out of `speech` or a storage lifecycle rule for
`hortai-private/speech-clips/` does not make them safe; both are hygiene on top, not the safeguard.

Cost: one synthesis per distinct text and voice. The three greetings are about 200 characters, the test sentence
40, each billed once (ElevenLabs Starter: 40,000 characters a month); cached clips cost nothing at ElevenLabs.

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

| Name                | Required | Notes                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `ALEXA_SKILL_ID`    | yes      | `amzn1.ask.skill.…` from the console. Unset → endpoint answers 503.    |
| `ALEXA_TUTOR_VOICE` | no       | `true` (default) speaks tutor replies in a tutor's voice; `false` off. |
| `ALEXA_TUTOR_ID`    | no       | Voice of tutor replies (not the launch greetings); default `max`.      |

The tutor voice also needs `ELEVENLABS_API_KEY` and object storage with `STORAGE_AZURE_PRIVATE_CONTAINER`
(`STORAGE_PROVIDER=azure`); without them every answer uses Alexa's voice.

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

- **Current: Vercel Production** `https://hort-ai.vercel.app/api/alexa` (console endpoint and `skill.json`), certificate
  type "sub-domain of a domain that has a wildcard certificate" (Vercel serves `*.vercel.app`). `ALEXA_SKILL_ID` is
  set in the Vercel project's Production environment. The production domain is not behind Vercel Authentication;
  it must stay that way, because Alexa cannot send bypass headers. Preview deployments are protected (401) and
  therefore unusable for Alexa. Quick check: an unsigned `POST` must answer **400** `invalid_alexa_request`;
  **503** `alexa_not_configured` means the skill id is missing in that environment.
- **Fallback: tunnel on the Hermes VM.** User units `hort-alexa-runner` (Node host on `127.0.0.1:3077`, bundles
  `src/modules/alexa` from this repository via `runner/build.mjs`) and `hort-alexa-tunnel` (cloudflared Quick
  Tunnel). The tunnel URL is **ephemeral**: every restart or VM reboot yields a new one
  (`journalctl --user -u hort-alexa-tunnel | grep trycloudflare`), which must be entered in the console (step 3).
  Use it only if Vercel fails; switch back afterwards.

## Known limits

- **8-second answer limit.** Alexa abandons a request after 8 s. Measured on Vercel Production: simulator round trip
  (speech recognition, endpoint, speech output) 2.1 s warm and 2.4 s after 17 minutes idle; an unsigned request
  takes 0.2 s. The first signed request per instance also downloads Amazon's certificate (0.4–2 s, cached per URL
  afterwards). On the VM fallback a 5.3 s outlier coincided with swapping; that process now runs without swap. An LLM tutor must stay well below 8 s end-to-end including a cold start
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
accepted as a reviewed, time-boxed exception until **2027-01-24** (decision B S, 2026-10-24). It is enforced by
`npm run audit:prod` (`scripts/audit-production.ts`), the first step of `npm run build:vercel` and `npm run check`:
every high or critical advisory in production dependencies fails the build, except this GHSA through its expiry
date; from 2027-01-25 it fails too. The team replaced GitHub Actions with the Vercel build, so the gate lives
there. Exit: a patched node-forge or SDK release, or replacing the SDK verifier with a `node:crypto` certificate-chain check.
