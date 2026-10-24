# Tutors

The animal tutors a child can choose (name, persona, voice, two pictures). No AI or speech logic
lives here; the persona only colours style, examples and greeting.

- `domain/tutors.json` — the catalog, single source for every tutor.
- `domain/tutor.ts` — its Zod schema (`tutorCatalogSchema`), parsed at import by `index.ts`.
- `scripts/sync-tutors.ts` — uploads pictures and `tutors/manifest.json` to the public container.

## Storage layout

In the public container (`STORAGE_AZURE_PUBLIC_CONTAINER`, served from `STORAGE_PUBLIC_BASE_URL`):

```
tutors/<id>/mund-zu.svg     mouth closed
tutors/<id>/mund-auf.svg    mouth open (shown while the tutor speaks)
tutors/manifest.json        the catalog with absolute picture URLs (`bilder`)
```

The browser loads the pictures directly from `STORAGE_PUBLIC_BASE_URL/tutors/<id>/...`.

## Adding a tutor

1. Add an entry to `domain/tutors.json`. `id` is lower-case without umlauts (it is the storage
   folder). `quelle` is the prefix of the designer's files.
2. Put the two SVGs into one folder, named `<quelle>_mund_zu.svg` and `<quelle>_mund_offen.svg`.
3. Sync, once per environment (the env file holds the `STORAGE_*` settings, see `.env.example`):

   ```bash
   npm run tutors:sync -- --env-file <storage.env> --source <svg folder> --dry-run
   npm run tutors:sync -- --env-file <storage.env> --source <svg folder>
   ```

The sync is idempotent: it overwrites the same keys, sets `Content-Type: image/svg+xml` and
`Cache-Control: public, max-age=86400` (manifest: 5 minutes) and checks size and type with `head`
after each upload. It never prints the account key or a signed URL. Locally it runs against
Azurite (`docker compose up`) with the values from `.env.example`.

## Voice (`stimme.tts`)

`stimme` describes the voice in words (`charakter`, `tempo`, `tonhoehe`); `stimme.tts` names the
concrete provider voice. Recommendation: Azure AI Speech (same subscription, German neural voices,
SSML for rate and pitch). Child-friendly candidates: `de-DE-KillianNeural` (Max),
`de-DE-GiselaNeural` (child voice, Lili), `de-DE-MajaNeural` (Fina); alternatives
`de-DE-AmalaNeural`, `de-DE-ConradNeural`. Map `tempo`/`tonhoehe` to SSML `prosody` when TTS is
built. Listen before choosing; nothing calls a TTS provider yet.

## Cleanup after the hackathon

All Azure resources live in one resource group tagged `purpose=hackathon-fulda-2026`,
`temporary=true`. Deleting it removes both storage accounts, their containers and the budget alert:

```bash
az group delete --name rg-hortai-hackathon-fulda-2026 --subscription "Zisch Startup Credits - Active"
```

Then remove the `STORAGE_*` values from Vercel and from the local env files.
