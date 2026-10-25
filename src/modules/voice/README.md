# Voice module

The tutors and the narrator speak (text-to-speech), and a child's recording becomes text
(speech-to-text). Both run on the server through ElevenLabs (`@lib/speech`); the API key never
reaches the browser. No AI, conversation flow or child UI lives here: callers decide what is said
and what happens with a transcript.

## Endpoints

| Route                           | In                                                         | Out                |
| ------------------------------- | ---------------------------------------------------------- | ------------------ |
| `POST /api/voice/speech`        | JSON `{ speakerId, phrase }` or `{ speakerId, ticket }`    | `audio/mpeg` (MP3) |
| `POST /api/voice/transcription` | multipart, fields `childProfileId` and `audio` (recording) | JSON `{ text }`    |

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
caller authenticates its own requests (Alexa: Amazon's signature). Because there is no actor, there is no ticket
and no consent to check, so it speaks **only fixed lines**: a catalog line of the tutor (`{ kind: 'phrase' }`) or a
channel sentence that matches `infrastructure/catalog/channel-lines.json` exactly (`{ kind: 'channel-line' }`).
Any other text (a child's words, a generated answer) is refused with `voice.validation.free_text_refused`, and the
channel falls back to its own voice. A new channel line is a reviewed edit of that file and must never name or
describe a child: the URL is fetched by a third party (Amazon).

Equal text in an equal voice is synthesized once: the clip is stored in the **private** container as
`speech-clips/<sha256>.mp3` (no text in the key) and returned as a 15-minute read-only SAS URL. Only a synthesis
spends the global budget `voice.hosted-synthesize` (60 per 10 minutes, denies when the limiter store is down); a
stored clip costs a HEAD. Concurrent requests for the same clip share one lookup and synthesis (in-memory single
flight per instance). The upload uses the store's signed one-object PUT (2 s timeout). Without a private container
it answers `voice.hosting_disabled`; a storage failure is `voice.clip_failed`.

## Rules

- **Text**: trimmed, not empty, at most `SPEECH_LIMITS.maxTextLength` (400) characters. Longer text
  is refused (`voice.validation.text_too_long`), never cut: the caller splits a reply into short
  pieces. Every character is billed (Starter: 40,000 a month).
- **Recording**: at most 4 MiB, one of `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`,
  `audio/wav` (`codecs=` parameters are stripped). The declared type comes from the client, so the
  bytes must carry that format's signature (WebM/EBML `1A 45 DF A3`, Ogg `OggS`, MP4 `ftyp` at
  offset 4, MP3 `ID3` or an MPEG frame sync, WAV `RIFF....WAVE`); otherwise
  `voice.validation.recording_content_mismatch` and nothing reaches the provider. Transcribed as German (`deu`, model
  `scribe_v1`, audio-event tags off). The recording is held in memory for the one request and
  never stored, neither by us nor as a file.
- **Consent**: a recording leaves the session only for the signed-in parent's own child (checked by
  the learner module, `GetChildProfileById`) and only while that child profile has `voiceConsent`:
  the voice control is on and the parent confirmed the current voice notice on their home
  (`SetVoiceConsent`, withdrawable at any time, #34). Otherwise `voice.consent_required`
  (403) and the interface stays with text. Another parent's child answers like a missing one
  (`voice.child_profile_not_found`, 404), so ids cannot be probed.
- **Transcript** is only returned, as a suggestion the child corrects; nothing is sent on. Wherever
  the corrected text is submitted, it goes through the same validation as typed text
  (`parseChildTaskText`, guidance module, #11).
- **Spoken text is never chosen by the client.** A body with `text` is refused
  (`voice.validation.free_text_refused`). Speakable are only:
  - `phrase`: a fixed line of a ready tutor from `tutors.json` (`greeting` = `begruessung`, `praise` =
    `lob_beispiel`, `tip` = `tipp_beispiel`); unknown lines answer `voice.unknown_phrase`.
  - `ticket`: issued by server code for a hint the guidance orchestrator validated
    (`getVoiceQueries().issueSpeechTicket.execute(outcome)` with a `generated` `HintOutcome`) and
    handed to the browser next to the text. It is `base64url(payload).HMAC-SHA256`, the key derived
    from `AUTH_SECRET`, bound to the parent (tenant and actor) and valid for 30 minutes. Forged,
    expired or foreign tickets answer `voice.validation.ticket_invalid`. Nothing is stored.

## Child UI in the help session (#34)

Browser controls live in `client.ts`; both take the server-stored `voiceConsent` as `allowed`, and the
server checks it again (fail closed).

- `VoiceInputButton` (`childProfileId`, `allowed`, `onTranscript`): tap to start and tap again, or hold
  and let go. Records with `MediaRecorder` (WebM, MP4 or Ogg, at most 30 s), posts once to
  `/api/voice/transcription` and hands the transcript to `onTranscript`; the caller puts it into the
  field, where the child corrects it before sending. A refused microphone, a browser without
  `MediaRecorder` or a missing consent leave typing as it is, with a short child-friendly line.
- `ReadAloudButton` (`childProfileId`, `message`, `allowed`): renders nothing without consent. On a
  press, the Server Action `readAloudAction` (use case `IssueReadAloudTicket`) gets a ticket for a
  message the browser only **names**: `{ kind: 'hint', index }` of the child's open help session,
  `{ kind: 'question' }` (the waiting comprehension question) or `{ kind: 'feedback', feedback }` (a
  fixed line: `praise`, `partly_correct`, `not_yet`, `unassessed`). The words come from the stored,
  validated session or, for predefined texts, from the guidance catalog in the exact wording the child
  sees. The ticket names the child's companion as speaker (the narrator while none is chosen) and is
  redeemed at `/api/voice/speech`, which spends the parent's speech budget. The audio is kept for the
  life of the button, so listening again costs no characters; key the button by its message.

Validated praise/encouragement and questions are also looked up from the stored answer check via
`{ kind: 'answer_feedback', index }` / `{ kind: 'answer_question', index }`. Only companion text is
exposed to the voice lookup; the child’s own answer/reply remains private in the store.

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

| Code                            | Status | Meaning                                                 |
| ------------------------------- | ------ | ------------------------------------------------------- |
| `voice.validation_failed`       | 422    | Text or recording broke a rule (see `fieldErrors`)      |
| `voice.unknown_speaker`         | 404    | No speaker with a voice has this id                     |
| `voice.unknown_phrase`          | 404    | The speaker has no such catalog line                    |
| `voice.consent_required`        | 403    | Voice is off on this child profile: use text            |
| `voice.child_profile_not_found` | 404    | Not a child profile of this parent (missing or foreign) |
| `voice.rate_limited`            | 429    | Budget spent; `Retry-After` says when to try again      |
| `voice.disabled`                | 502    | No `ELEVENLABS_API_KEY`                                 |
| `voice.rate_limiter_failed`     | 502    | The limiter store is down                               |
| `voice.hosting_disabled`        | -      | Hosted speech without a private storage container       |
| `voice.clip_failed`             | -      | Hosted speech: storing or signing the clip failed       |
| `speech.unavailable`            | 502    | Provider timeout, 5xx or network failure: retry later   |
| `speech.throttled`              | 502    | Provider 429 (too many concurrent requests): retry soon |
| `speech.quota_exceeded`         | 502    | Plan quota used up or the voice needs another plan      |
| `speech.rejected`               | 502    | Bad key, unknown voice, malformed request: fix config   |

Infrastructure failures are logged once by the composition root (code and status only, never the
key, text or audio).
