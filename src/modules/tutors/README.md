# Tutors

The animal tutors a child can choose (name, persona, voice, two pictures). No AI or speech logic
lives here; the persona only colours style, examples and greeting.

- `presentation/catalog/tutors.json` — the catalog, single source for every tutor.
- `presentation/schemas/tutor-catalog-schema.ts` — its Zod schema (`tutorCatalogSchema`), parsed at import by `index.ts`.
- `scripts/sync-tutors.ts` — uploads pictures and `tutors/manifest.json` to the public container.

## Storage layout

In the public container (`STORAGE_AZURE_PUBLIC_CONTAINER`, served from `STORAGE_PUBLIC_BASE_URL`):

```
tutors/<id>/mund-zu.svg     mouth closed
tutors/<id>/mund-auf.svg    mouth open (shown while the tutor speaks)
tutors/<id>/vorstellung.mp3 spoken introduction (15 to 19 s), plays without any speech provider
tutors/manifest.json        the catalog with absolute picture URLs (`bilder`)
```

The browser loads the pictures directly from `STORAGE_PUBLIC_BASE_URL/tutors/<id>/...`.

## Showing a tutor

Use the shared `Character` component (`src/components/brand/character.tsx`) with `tutorImageKey(id, 'mund_zu')` and `tutorImageKey(id, 'mund_auf')` resolved against `STORAGE_PUBLIC_BASE_URL`, and `useCharacterVoice` (`src/hooks/use-character-voice.ts`) with `tutorIntroKey(id)` to play the introduction. The lip sync (mouth open while the audio plays) is in `Character`; this module stays the catalog and the storage keys, so every screen that shows a tutor reuses the same two pieces. The pictures currently have an opaque white background, so show them on a rounded, clipped white card or on white.

## Adding a tutor

1. Add an entry to `presentation/catalog/tutors.json`. `id` is lower-case without umlauts (it is the storage
   folder). `quelle` is the prefix of the designer's files.
2. Put the two SVGs into one folder, named `<quelle>_mund_zu.svg` and `<quelle>_mund_offen.svg`.
3. Sync, once per environment (the env file holds the `STORAGE_*` settings, see `.env.example`):

   ```bash
   npm run tutors:sync -- --env-file <storage.env> --source <svg folder> --dry-run
   npm run tutors:sync -- --env-file <storage.env> --source <svg folder>
   ```

The sync is idempotent: it overwrites the same keys, sets `Content-Type: image/svg+xml` and
`Cache-Control: public, max-age=86400` (manifest: 5 minutes) and checks size and type with `head`
after each upload. It never prints the account key or a signed URL. Inputs are all read before
writing; the manifest is published last, but this is not an atomic multi-blob deployment. Overwrites
may remain cached for up to one day; use versioned URLs/cache busting in a future asset rollout if
immediate replacement is required. Original SVGs are kept byte-for-byte (no unverified optimization).
Locally it runs against Azurite (`docker compose --env-file .env.docker up -d`) with the values
from `.env.example`.

## Voice (`stimme.tts`)

`stimme` describes the voice in words (`charakter`, `tempo`, `tonhoehe`); `stimme.tts` names the
concrete provider voice. Recommendation: Azure AI Speech (same subscription, German neural voices,
SSML for rate and pitch). Child-friendly candidates: `de-DE-KillianNeural` (Max),
`de-DE-GiselaNeural` (child voice, Lili), `de-DE-MajaNeural` (Fina); alternatives
`de-DE-AmalaNeural`, `de-DE-ConradNeural`. Map `tempo`/`tonhoehe` to SSML `prosody` when TTS is
built. Listen before choosing; nothing calls a TTS provider yet. These are candidates, not
an acoustic acceptance test. Microsoft's [voice list](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
marks Gisela as a child voice; Killian and Maja are not listed as child voices. Check regional
availability and credit eligibility when provisioning Speech; no Speech resource is created here.

## Integration handoff (not implemented here)

- #12 (start screen): offer only tutors with `status === 'bereit'`; show name, animal and closed-mouth
  image. Store the selected stable `id` on the authorized child profile, not the image URL or display
  name. After reload/sign-in restore it; reject unknown/draft ids server-side and offer a new selection
  if a previously selected tutor is removed. A local-only choice cannot meet cross-device persistence.
- #34 (voice): resolve `stimme.tts` from that id on the server. Animate only while actual audio plays,
  alternating the two images; reset to closed on end, pause, cancel, error, profile/tutor change and
  unmount. Preload both pictures. No provider keys in browser code, no new image upload during speech.
  Text remains usable when audio fails. Two images approximate speech, not phoneme-accurate lip sync.
- #20 (design): carry the selected companion consistently across screens; use visible selection and
  reduced-motion behaviour. Personas remain editorial content, not a substitute for global safety rules.
- #18 (E2E): cover choosing each tutor, restored selection, child-profile isolation, unknown/draft
  rejection and image states on play/end/cancel/error with a fake audio adapter. These criteria need
  to be added by the respective issue owners; this PR does not implement selection, persistence or TTS.

Use the checked-in catalog through the module API on the server; pass only needed data to Client
Components. Alternatively, `tutors/manifest.json` is a public delivery artifact with absolute URLs,
not the editing source. Source mapping (`quelle`) is intentionally absent there.

## Cleanup after the hackathon

All Azure resources live in one resource group tagged `purpose=hackathon-fulda-2026`,
`temporary=true`. Deleting it removes both storage accounts, their containers and the budget alert:

```bash
az group delete --name rg-hortai-hackathon-fulda-2026 --subscription "Zisch Startup Credits - Active"
```

Then remove the `STORAGE_*` values from Vercel and from the local env files.
