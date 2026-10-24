import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NextIntlClientProvider } from '@i18n/client';

import { LessonSpecimen } from '@/app/[locale]/(public)/design-system/_components/lesson-specimen';
import enApp from '@/i18n/messages/en.json';

function renderScene() {
  render(
    <NextIntlClientProvider locale="en" messages={{ app: enApp }} timeZone="Europe/Berlin">
      <LessonSpecimen />
    </NextIntlClientProvider>,
  );
}

describe('LessonSpecimen', () => {
  it('moves named objects one by one and allows a full reset', () => {
    renderScene();

    expect(screen.getByText('0 of 3 apples')).toBeVisible();
    const first = screen.getByRole('button', { name: 'Put apple 1 in the basket' });
    first.focus();
    expect(first).toHaveFocus();

    fireEvent.click(first);
    fireEvent.click(screen.getByRole('button', { name: 'Put apple 2 in the basket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Put apple 3 in the basket' }));

    expect(first).toBeDisabled();
    expect(screen.getByText('3 of 3 apples')).toBeVisible();
    expect(screen.getByText('All three apples!').closest('[role="status"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));

    expect(screen.getByText('0 of 3 apples')).toBeVisible();
    expect(first).toBeEnabled();
    expect(screen.queryByText('All three apples!')).not.toBeInTheDocument();
  });
});
