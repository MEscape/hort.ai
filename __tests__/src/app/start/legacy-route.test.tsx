import { expect, it, vi } from 'vitest';

import { redirect } from '@i18n';

import StartPage from '@/app/[locale]/(public)/start/page';

vi.mock('@i18n', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  redirect: vi.fn(),
}));

it('sends legacy start links to the canonical child home', async () => {
  await StartPage({ params: Promise.resolve({ locale: 'de' }) });
  expect(redirect).toHaveBeenCalledWith({ href: '/home', locale: 'de' });
});
