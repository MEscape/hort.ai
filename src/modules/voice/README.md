# Voice module

The tutors and the narrator speak (text-to-speech), and a child's recording becomes text
(speech-to-text). Both run on the server through ElevenLabs (`@lib/speech`); the API key never
reaches the browser. No AI, conversation flow or child UI lives here: callers decide what is said
and what happens with a transcript.

## Endpoints

| Route                           | In                                     | Out                |
| ------------------------------- | -------------------------------------- | ------------------ |
| `POST /api/voice/speech`        | JSON `{ speakerId, text }`             | `audio/mpeg` (MP3) |
| `POST /api/voice/transcription` | multipart, field `audio` (a recording) | JSON `{ text }`    |

Route Handlers rather than Server Actions because both carry binary audio. Both answer
`Cache-Control: no-store`; errors use the shared shape `{ code, message, fieldErrors?,
retryAfterSeconds? }` with the status from `@lib/errors`.

Both use cases (`SynthesizeSpeech`, `TranscribeSpeech`) require the signed-in parent's
`voice.use` permission (the child speaks within the guardian's session), then validate, then spend
a budget of 30 calls per parent in ten minutes (`application/rate-limits.ts`, denies when the
limiter store is down), and only then call the provider.

## Hosted speech (server channels)

`getHostedSpeech()` (exported from `index.ts`, use case `GetHostedSpeech`) is for server-side channels that play
audio from a link instead of receiving bytes; today only Alexa. It has no actor (`@authorization system`): the
caller authenticates its own requests (Alexa: Amazon's signature) and passes trusted text. Equal text in an equal
voice is synthesized once: the clip is stored in the **private** container as `speech-clips/<sha256>.mp3` (no
text in the key) and returned as a 15-minute read-only SAS URL. Only a synthesis spends the global budget
`voice.hosted-synthesize` (60 per 10 minutes, denies when the limiter store is down); a stored clip costs a HEAD.
The upload uses the store's signed one-object PUT (2 s timeout). Without a private container it answers
`voice.hosting_disabled`; a storage failure is `voice.clip_failed`. Never pass text that identifies a child: the
URL is fetched by a third party (Amazon).

## Rules

- **Text**: trimmed, not empty, at most `SPEECH_LIMITS.maxTextLength` (400) characters. Longer text
  is refused (`voice.validation.text_too_long`), never cut: the caller splits a reply into short
  pieces. Every character is billed (Starter: 40,000 a month).
- **Recording**: at most 4 MiB, one of `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`,
  `audio/wav` (`codecs=` parameters are stripped). Transcribed as German (`deu`, model
  `scribe_v1`, audio-event tags off). The recording is held in memory for the one request and
  never stored, neither by us nor as a file.
- **Transcript** is a suggestion: the child corrects it before sending, and the sent text goes
  through the same server-side validation as typed text (issue #34). Only validated text should be
  passed to `/api/voice/speech`.

## Speakers and voices

A speaker is a tutor that is `bereit` with `stimme.tts.provider: "elevenlabs"` in
`src/modules/tutors/presentation/catalog/tutors.json`, or the narrator in
`infrastructure/catalog/narrator.json`. The narrator (the owl) is the app's voice, not a tutor, and
its name is still open. Swapping a voice means editing `voiceId` in one of those files, no code
change.

| Speaker  | `speakerId` | `voiceId`              | ElevenLabs voice         |
| -------- | ----------- | ---------------------- | ------------------------ |
| Max      | `max`       | `DsJNFaZXbVnwO9Nycgo3` | Barnaby                  |
| Lili     | `lili`      | `8pVdES9f9x71wHWeQsgz` | Nicole                   |
| Fina     | `fina`      | `zndmYEEoWWxRYyEL2ZZY` | Lumi (Funny and Playful) |
| Narrator | `eule`      | `YyYOpSknZlewhHezK5bv` | Oswald                   |

These are library voices: they need a paid ElevenLabs plan (Starter or higher). On the free plan
they fail with `speech.quota_exceeded` (HTTP 402 `paid_plan_required`).

## Configuration

| Variable                  | Default                     | Meaning                                    |
| ------------------------- | --------------------------- | ------------------------------------------ |
| `ELEVENLABS_API_KEY`      | unset                       | Server-only secret. Unset turns speech off |
| `ELEVENLABS_API_URL`      | `https://api.elevenlabs.io` | API origin (https in production)           |
| `ELEVENLABS_TTS_MODEL_ID` | `eleven_multilingual_v2`    | Text-to-speech model                       |
| `ELEVENLABS_STT_MODEL_ID` | `scribe_v1`                 | Speech-to-text model                       |
| `ELEVENLABS_TIMEOUT_MS`   | `20000`                     | Timeout of one provider call               |

Without a key the app starts normally and both endpoints answer `voice.disabled` (502); the
interface falls back to text, as it must when the microphone is refused.

## Errors

| Code                        | Status | Meaning                                                 |
| --------------------------- | ------ | ------------------------------------------------------- |
| `voice.validation_failed`   | 422    | Text or recording broke a rule (see `fieldErrors`)      |
| `voice.unknown_speaker`     | 404    | No speaker with a voice has this id                     |
| `voice.rate_limited`        | 429    | Budget spent; `Retry-After` says when to try again      |
| `voice.disabled`            | 502    | No `ELEVENLABS_API_KEY`                                 |
| `voice.rate_limiter_failed` | 502    | The limiter store is down                               |
| `voice.hosting_disabled`    | -      | Hosted speech without a private storage container       |
| `voice.clip_failed`         | -      | Hosted speech: storing or signing the clip failed       |
| `speech.unavailable`        | 502    | Provider timeout, 5xx or network failure: retry later   |
| `speech.throttled`          | 502    | Provider 429 (too many concurrent requests): retry soon |
| `speech.quota_exceeded`     | 502    | Plan quota used up or the voice needs another plan      |
| `speech.rejected`           | 502    | Bad key, unknown voice, malformed request: fix config   |

Infrastructure failures are logged once by the composition root (code and status only, never the
key, text or audio).
