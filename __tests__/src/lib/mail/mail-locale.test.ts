import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18N_CONFIG } from '@i18n';

import { resolveMailLocale } from '@lib/mail/server';

const { getLocale } = vi.hoisted(() => ({ getLocale: vi.fn<() => Promise<string>>() }));

vi.mock('@i18n/server', () => ({ getLocale }));

beforeEach(() => {
  getLocale.mockReset();
});

describe('resolveMailLocale', () => {
  it.each(['de', 'en'])('follows the request language %s', async (locale) => {
    getLocale.mockResolvedValue(locale);

    await expect(resolveMailLocale()).resolves.toBe(locale);
  });

  it('falls back to the default locale for an unsupported language', async () => {
    getLocale.mockResolvedValue('fr');

    await expect(resolveMailLocale()).resolves.toBe(I18N_CONFIG.defaultLocale);
  });

  it('falls back to the default locale outside a request', async () => {
    getLocale.mockRejectedValue(new Error('outside a request'));

    await expect(resolveMailLocale()).resolves.toBe(I18N_CONFIG.defaultLocale);
  });
});
