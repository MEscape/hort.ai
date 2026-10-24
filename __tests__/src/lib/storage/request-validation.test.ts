import { describe, expect, it } from 'vitest';

import type { UploadRequest } from '@lib/storage';
import {
  validateObjectKey,
  validateReadStartBytes,
  validateReadUrlRequest,
  validateUploadRequest,
} from '@lib/storage/request-validation';
import { STORAGE_ERROR_CODES } from '@lib/storage/storage-errors';
import {
  MAX_CACHE_CONTROL_LENGTH,
  MAX_CONTENT_TYPE_LENGTH,
  MAX_OBJECT_KEY_LENGTH,
  MAX_READ_START_BYTES,
  MAX_SIGNED_URL_TTL_SECONDS,
  MAX_UPLOAD_BYTES,
} from '@lib/storage/storage-limits';

const upload: UploadRequest = {
  location: { visibility: 'public', key: 'avatars/u1.png' },
  contentType: 'image/png',
  byteSize: 1024,
  cacheControl: 'public, max-age=60',
  expiresInSeconds: 60,
};

function codeOf(result: { isErr(): boolean; error?: { code: string } }): string | undefined {
  return result.isErr() ? result.error?.code : undefined;
}

describe('validateObjectKey', () => {
  it.each(['a', 'avatars/u1.png', 'a-b_c.d/e', 'x'.repeat(MAX_OBJECT_KEY_LENGTH)])(
    'accepts %s',
    (key) => {
      expect(validateObjectKey(key).isOk()).toBe(true);
    },
  );

  it.each([
    '',
    '/a',
    'a/',
    'a//b',
    '../a',
    'a/./b',
    'a/..',
    '..',
    'a b',
    'ä',
    'x'.repeat(MAX_OBJECT_KEY_LENGTH + 1),
  ])('refuses %j', (key) => {
    expect(codeOf(validateObjectKey(key))).toBe(STORAGE_ERROR_CODES.invalidKey);
  });
});

describe('validateUploadRequest', () => {
  it('accepts a well-formed request unchanged', () => {
    const result = validateUploadRequest(upload);

    expect(result.isOk() && result.value).toBe(upload);
  });

  it.each([
    [
      'key',
      { location: { visibility: 'public' as const, key: '../x' } },
      STORAGE_ERROR_CODES.invalidKey,
    ],
    ['content type shape', { contentType: 'image/PNG' }, STORAGE_ERROR_CODES.invalidRequest],
    [
      'content type parameters',
      { contentType: 'text/plain; charset=utf-8' },
      STORAGE_ERROR_CODES.invalidRequest,
    ],
    [
      'content type length',
      { contentType: `a/${'b'.repeat(MAX_CONTENT_TYPE_LENGTH)}` },
      STORAGE_ERROR_CODES.invalidRequest,
    ],
    ['size zero', { byteSize: 0 }, STORAGE_ERROR_CODES.invalidRequest],
    ['size fraction', { byteSize: 1.5 }, STORAGE_ERROR_CODES.invalidRequest],
    ['size too large', { byteSize: MAX_UPLOAD_BYTES + 1 }, STORAGE_ERROR_CODES.invalidRequest],
    [
      'cache control characters',
      { cacheControl: 'no-store\r\nX: y' },
      STORAGE_ERROR_CODES.invalidRequest,
    ],
    [
      'cache control length',
      { cacheControl: 'a'.repeat(MAX_CACHE_CONTROL_LENGTH + 1) },
      STORAGE_ERROR_CODES.invalidRequest,
    ],
    ['lifetime zero', { expiresInSeconds: 0 }, STORAGE_ERROR_CODES.invalidRequest],
    [
      'lifetime too long',
      { expiresInSeconds: MAX_SIGNED_URL_TTL_SECONDS + 1 },
      STORAGE_ERROR_CODES.invalidRequest,
    ],
  ])('refuses a bad %s', (_name, override, code) => {
    expect(codeOf(validateUploadRequest({ ...upload, ...override }))).toBe(code);
  });
});

describe('validateReadUrlRequest', () => {
  const read = { visibility: 'private' as const, key: 'docs/report.pdf', expiresInSeconds: 60 };

  it('accepts a well-formed request', () => {
    expect(validateReadUrlRequest(read).isOk()).toBe(true);
  });

  it('refuses a bad key and a bad lifetime', () => {
    expect(codeOf(validateReadUrlRequest({ ...read, key: '../x' }))).toBe(
      STORAGE_ERROR_CODES.invalidKey,
    );
    expect(codeOf(validateReadUrlRequest({ ...read, expiresInSeconds: 0 }))).toBe(
      STORAGE_ERROR_CODES.invalidRequest,
    );
  });
});

describe('validateReadStartBytes', () => {
  it.each([1, MAX_READ_START_BYTES])('accepts %d', (count) => {
    expect(validateReadStartBytes(count).isOk()).toBe(true);
  });

  it.each([0, -1, 1.5, MAX_READ_START_BYTES + 1, Number.NaN])('refuses %d', (count) => {
    expect(codeOf(validateReadStartBytes(count))).toBe(STORAGE_ERROR_CODES.invalidRequest);
  });
});
