import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { APP_IDENTITY } from '@lib/config';

import StartPage from '@/app/[locale]/(public)/start/page';
import app from '@/i18n/messages/en.json';

async function renderStart() {
  const page = await StartPage({ params: Promise.resolve({ locale: 'en' }) });
  return render(
    <I18nClientProvider locale="en" messages={{ app }} timeZone="Europe/Berlin" isDevelopment>
      {page}
    </I18nClientProvider>,
  );
}

describe('integrated homework start screen', () => {
  it('uses the official Hort.ai branding on the existing start screen', async () => {
    const { container } = await renderStart();
    expect(screen.getByRole('img', { name: APP_IDENTITY.name })).toHaveAttribute(
      'src',
      APP_IDENTITY.assets.logo,
    );
    expect(
      container.querySelector(`use[href="${APP_IDENTITY.assets.owl}#face-hello"]`),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'My task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'School tasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('clears a local task without submitting the form', async () => {
    await renderStart();
    fireEvent.click(screen.getByRole('button', { name: 'My task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const task = screen.getByRole('textbox', { name: 'Your task' });
    expect(task).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Write your task here first.');
    fireEvent.change(task, { target: { value: 'Read page 12.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('status')).toHaveTextContent('Your task was not sent or saved.');
    const clear = screen.getByRole('button', { name: 'Clear text' });
    expect(clear).toHaveProperty('type', 'button');
    fireEvent.click(clear);
    expect(task).toHaveValue('');
    expect(task).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'My task' })).toHaveFocus();
  });
});
