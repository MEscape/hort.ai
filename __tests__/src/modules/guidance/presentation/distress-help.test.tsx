import { createRef } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DistressHelp } from '@modules/guidance/presentation/components/distress-help';
import de from '@modules/guidance/presentation/i18n/de.json';
import en from '@modules/guidance/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { TaskEntry } from '@/app/[locale]/(public)/start/_components/task-entry';
import appDe from '@/i18n/messages/de.json';
import appEn from '@/i18n/messages/en.json';

const action = vi.hoisted(() => vi.fn());
vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@modules/guidance/presentation/actions/start-help-session-action', () => ({
  startHelpSessionAction: action,
}));

const CODE = 'guidance.child_safety.distress_signal';

describe('fixed distress help (#90)', () => {
  it('shows trusted-adult and anonymous helpline help, with immediate emergency calls', () => {
    render(
      <I18nClientProvider locale="de" messages={de} timeZone="Europe/Berlin" isDevelopment>
        <DistressHelp />
      </I18nClientProvider>,
    );
    expect(screen.getByRole('heading', { name: de.guidance.distress.title })).toBeVisible();
    expect(screen.getByText(de.guidance.distress.brave)).toBeVisible();
    expect(screen.getByText(de.guidance.distress.trustedAdult)).toBeVisible();
    expect(screen.getByText(de.guidance.distress.hotline)).toBeVisible();
    expect(screen.getByText(de.guidance.distress.hours)).toBeVisible();
    expect(screen.getByText(de.guidance.distress.emergency)).toBeVisible();
    expect(screen.getByRole('link', { name: '116 111' })).toHaveAttribute('href', 'tel:116111');
    expect(screen.getByRole('link', { name: '110' })).toHaveAttribute('href', 'tel:110');
    expect(screen.getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(['de', 'en'] as const)(
    'renders the real %s help after a distress task and discards the draft',
    async (locale) => {
      const messages = locale === 'de' ? de : en;
      const app = locale === 'de' ? appDe : appEn;
      action.mockResolvedValueOnce({
        ok: false,
        error: { code: CODE, message: 'not for display' },
      });
      const onDraftChange = vi.fn();
      render(
        <I18nClientProvider
          locale={locale}
          messages={{ ...messages, app }}
          timeZone="Europe/Berlin"
          isDevelopment
        >
          <TaskEntry
            childProfileId="child-1"
            headingRef={createRef<HTMLHeadingElement>()}
            draft="Ich will nicht mehr leben"
            onDraftChange={onDraftChange}
          />
        </I18nClientProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: app.start.entry.review }));
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: messages.guidance.distress.title }),
        ).toBeVisible();
      });
      expect(screen.getByText(messages.guidance.distress.trustedAdult)).toBeVisible();
      expect(screen.getByText(messages.guidance.distress.hours)).toBeVisible();
      expect(screen.getByRole('link', { name: '116 111' })).toHaveAttribute('href', 'tel:116111');
      expect(screen.getByRole('link', { name: '110' })).toHaveAttribute('href', 'tel:110');
      expect(screen.getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(onDraftChange).toHaveBeenCalledWith('');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByText('start.entry.failed')).not.toBeInTheDocument();
      expect(screen.queryByText('not for display')).not.toBeInTheDocument();
    },
  );
});
