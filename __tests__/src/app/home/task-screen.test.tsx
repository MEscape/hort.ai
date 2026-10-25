import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { TaskScreen } from '@/app/[locale]/(app)/home/task/_components/task-screen';
import app from '@/i18n/messages/en.json';

const { push, startHelpSession } = vi.hoisted(() => ({ push: vi.fn(), startHelpSession: vi.fn() }));

vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push }),
}));
vi.mock('@modules/guidance/client', () => ({ startHelpSessionAction: startHelpSession }));

function renderScreen() {
  return render(
    <I18nClientProvider locale="en" messages={{ app }} timeZone="Europe/Berlin" isDevelopment>
      <TaskScreen childProfileId="child-1" />
    </I18nClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  startHelpSession.mockReset();
});

it('validates, edits and clears the task before anything is sent', () => {
  renderScreen();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  const input = screen.getByRole('textbox', { name: 'Your task' });
  expect(input).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Write your task here first.');
  fireEvent.change(input, { target: { value: 'Read page 12.' } });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Clear text' }));
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
  expect(startHelpSession).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/en/home');
});

it('starts a help session with the typed task and opens it', async () => {
  startHelpSession.mockResolvedValue({ ok: true, data: {} });
  renderScreen();
  fireEvent.change(screen.getByRole('textbox', { name: 'Your task' }), {
    target: { value: '3 + 4' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  await waitFor(() => {
    expect(push).toHaveBeenCalledWith('/help');
  });
  expect(startHelpSession).toHaveBeenCalledWith({
    childProfileId: 'child-1',
    task: '3 + 4',
    subject: 'math',
  });
});

it('keeps the task and says so when the session could not be started', async () => {
  startHelpSession.mockResolvedValue({ ok: false, error: { code: 'x' } });
  renderScreen();
  const input = screen.getByRole('textbox', { name: 'Your task' });
  fireEvent.change(input, { target: { value: '3 + 4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
  expect(input).toHaveValue('3 + 4');
});
