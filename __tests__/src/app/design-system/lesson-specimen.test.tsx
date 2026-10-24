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
  it("shows the child's own task with one hint at a time, never a solution or a score", () => {
    renderScene();

    expect(screen.getByText('Your task from school')).toBeVisible();
    expect(screen.getByText('Hint 1')).toBeVisible();
    expect(screen.queryByText('Hint 2')).not.toBeInTheDocument();
    const reset = screen.getByRole('button', { name: 'Start again' });
    expect(reset).toBeDisabled();

    const next = screen.getByRole('button', { name: 'Another hint' });
    fireEvent.click(next);
    fireEvent.click(next);

    expect(screen.getByText('Hint 3')).toBeVisible();
    expect(next).toBeDisabled();
    expect(screen.getByText(/That was the last hint/)).toBeVisible();
    expect(screen.queryByText(/\b12\b|\bstars?\b|\bpoints?\b|\bXP\b/i)).not.toBeInTheDocument();

    fireEvent.click(reset);

    expect(screen.queryByText('Hint 2')).not.toBeInTheDocument();
    expect(next).toBeEnabled();
  });
});
