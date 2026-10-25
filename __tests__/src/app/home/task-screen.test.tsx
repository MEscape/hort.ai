import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { TaskScreen } from '@/app/[locale]/(app)/home/task/_components/task-screen';
import app from '@/i18n/messages/en.json';

it('preserves task validation, editing and clearing without claiming to save', () => {
  render(
    <I18nClientProvider locale="en" messages={{ app }} timeZone="Europe/Berlin" isDevelopment>
      <TaskScreen />
    </I18nClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  const input = screen.getByRole('textbox', { name: 'Your task' });
  expect(input).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('Write your task here first.');
  fireEvent.change(input, { target: { value: 'Read page 12.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.getByRole('status')).toHaveTextContent('Your task was not sent or saved.');
  fireEvent.click(screen.getByRole('button', { name: 'Clear text' }));
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
  expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/en/home');
});
