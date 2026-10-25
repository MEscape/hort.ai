import type { ReactElement } from 'react';

import { expect, it, vi } from 'vitest';

import TaskPage from '@/app/[locale]/(app)/home/task/page';

const redirect = vi.hoisted(() =>
  vi.fn((_target: { href: string; locale: string }) => {
    throw new Error('NEXT_REDIRECT');
  }),
);

vi.mock('@i18n', () => ({ redirect, requireLocale: (locale: string) => locale }));

interface InnerProps {
  readonly params: Promise<{ locale: string }>;
}

it('sends the old placeholder entry /home/task to the real task entry on /start', async () => {
  const page = TaskPage({ params: Promise.resolve({ locale: 'de' }) }) as ReactElement<{
    children: ReactElement<InnerProps>;
  }>;
  const inner = page.props.children;
  const render = inner.type as (props: InnerProps) => Promise<never>;
  await expect(render(inner.props)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith({ href: '/start', locale: 'de' });
});
