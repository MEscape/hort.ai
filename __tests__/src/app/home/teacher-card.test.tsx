import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { TeacherCard } from '@/app/[locale]/(app)/home/_components/teacher-card';
import app from '@/i18n/messages/en.json';

vi.mock('@i18n', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderCard(newCount: number | null) {
  render(
    <I18nClientProvider locale="en" messages={{ app }} timeZone="Europe/Berlin" isDevelopment>
      <TeacherCard newCount={newCount} isGuided={false} />
    </I18nClientProvider>,
  );
  return screen.getByRole('link', { name: /From my teacher/ });
}

describe('TeacherCard', () => {
  it('leads to the school tasks and writes how many are new', () => {
    const card = renderCard(2);
    expect(card).toHaveAttribute('href', '/help?new=1');
    expect(card).toHaveTextContent('2 new');
  });

  it('says calmly that the teacher has nothing new', () => {
    expect(renderCard(0)).toHaveTextContent(app.home.teacher.none);
  });

  it('stays a plain way to the school tasks while the count is unknown', () => {
    const card = renderCard(null);
    expect(card).toHaveAttribute('href', '/help?new=1');
    expect(card).toHaveTextContent(app.home.teacher.open);
  });
});
