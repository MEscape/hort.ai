#!/usr/bin/env tsx
/**
 * Uploads every tutor's two pictures and the tutor catalog to the public storage container,
 * through the app's own `ObjectStore` (signed PUT, then `head` to confirm what arrived).
 *
 *   npm run tutors:sync -- --env-file <storage.env> --source <dir with the designer's SVGs> [--dry-run]
 *
 * Source files are named `<quelle>_mund_zu.svg` and `<quelle>_mund_offen.svg` (`quelle` from the
 * catalog); they land at `tutors/<id>/mund-zu.svg` and `tutors/<id>/mund-auf.svg`. The catalog
 * itself lands at `tutors/manifest.json`. Signed URLs and the account key are never printed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { parse as parseDotenv } from 'dotenv';

import { systemClock } from '@lib/clock';
import { storageEnvSchema } from '@lib/config/storage-env-schema';
import { createObjectStore } from '@lib/storage/create-object-store';
import type { ObjectStore } from '@lib/storage';
import { tutorCatalog, tutorImageKey, TUTOR_STORAGE_PREFIX } from '@modules/tutors';
import type { TutorImage } from '@modules/tutors';

const SOURCE_SUFFIX: Record<TutorImage, string> = { mund_zu: 'mund_zu', mund_auf: 'mund_offen' };
const IMAGE_CACHE = 'public, max-age=86400';
const MANIFEST_CACHE = 'public, max-age=300';
const UPLOAD_TTL_SECONDS = 300;

interface Upload {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType: string;
  readonly cacheControl: string;
}

function fail(message: string): never {
  process.stderr.write(`sync-tutors: ${message}\n`);
  process.exit(1);
}

function loadStore(envFile: string): ObjectStore {
  const parsed = storageEnvSchema.safeParse(parseDotenv(readFileSync(envFile)));
  if (!parsed.success) {
    fail(
      `invalid storage settings in ${envFile}: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  const store = createObjectStore(parsed.data, { clock: systemClock });
  if (store === null || !store.supports('public')) {
    fail('STORAGE_PROVIDER=azure with a public container is required.');
  }
  return store;
}

function readSvg(path: string): Uint8Array {
  const body = readFileSync(path);
  const head = body.subarray(0, 256).toString('utf8').trimStart();
  if (!head.startsWith('<svg') && !head.startsWith('<?xml')) {
    fail(`${path} does not look like an SVG.`);
  }
  return body;
}

function planUploads(source: string): Upload[] {
  const uploads: Upload[] = [];
  for (const tutor of tutorCatalog.tutoren) {
    for (const image of Object.keys(SOURCE_SUFFIX) as TutorImage[]) {
      uploads.push({
        key: tutorImageKey(tutor.id, image),
        body: readSvg(join(source, `${tutor.quelle}_${SOURCE_SUFFIX[image]}.svg`)),
        contentType: 'image/svg+xml',
        cacheControl: IMAGE_CACHE,
      });
    }
  }
  return uploads;
}

function manifestUpload(store: ObjectStore): Upload {
  const manifest = {
    version: tutorCatalog.version,
    tutoren: tutorCatalog.tutoren.map(({ quelle: _quelle, ...tutor }) => ({
      ...tutor,
      bilder: {
        mund_zu: store.publicUrl(tutorImageKey(tutor.id, 'mund_zu')),
        mund_auf: store.publicUrl(tutorImageKey(tutor.id, 'mund_auf')),
      },
    })),
  };
  return {
    key: `${TUTOR_STORAGE_PREFIX}/manifest.json`,
    body: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
    contentType: 'application/json',
    cacheControl: MANIFEST_CACHE,
  };
}

async function upload(store: ObjectStore, item: Upload): Promise<void> {
  const location = { visibility: 'public' as const, key: item.key };
  const target = await store.createUploadTarget({
    location,
    contentType: item.contentType,
    byteSize: item.body.byteLength,
    cacheControl: item.cacheControl,
    expiresInSeconds: UPLOAD_TTL_SECONDS,
  });
  if (target.isErr()) {
    fail(`${item.key}: ${target.error.code}`);
  }
  const response = await fetch(target.value.url, {
    method: 'PUT',
    headers: target.value.headers,
    body: item.body,
  });
  if (response.status !== 201) {
    fail(`${item.key}: upload answered HTTP ${response.status}`);
  }
  const stored = await store.head(location);
  if (stored.isErr() || stored.value === null) {
    fail(`${item.key}: not found after upload`);
  }
  if (
    stored.value.byteSize !== item.body.byteLength ||
    stored.value.contentType !== item.contentType
  ) {
    fail(`${item.key}: stored size or content type differs`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'env-file': { type: 'string' },
      source: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const envFile = values['env-file'] ?? fail('--env-file <path> is required.');
  const source = values.source ?? fail('--source <dir> is required.');

  const store = loadStore(envFile);
  const uploads = [...planUploads(source), manifestUpload(store)];
  for (const item of uploads) {
    if (!values['dry-run']) {
      await upload(store, item);
    }
    const kib = Math.round(item.body.byteLength / 1024);
    process.stdout.write(
      `${values['dry-run'] ? 'would upload' : 'uploaded'} ${item.key} (${kib} KiB) -> ${store.publicUrl(item.key)}\n`,
    );
  }
  process.stdout.write(`${uploads.length} objects, ${tutorCatalog.tutoren.length} tutors.\n`);
}

await main();
