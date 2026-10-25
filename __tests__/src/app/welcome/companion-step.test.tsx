import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Interest, TutorOption } from '@modules/learner/client';
import en from '@modules/learner/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { CompanionStep } from '@/app/[locale]/(app)/hello/_components/companion-step';
import app from '@/i18n/messages/en.json';

import { stubMotion } from '../../components/shared/fake-audio';

function tutor(id: string, name: string, topics: string[]): TutorOption {
  return {
    id,
    name,
    animal: 'Hund',
    description: 'Ein Begleiter.',
    traits: ['treu', 'ermutigend', 'sportlich', 'laut'],
    topics,
    greeting: 'Hallo!',
    voice: 'freundlich',
    imageUrl: `/${id}.svg`,
    imageOpenUrl: `/${id}-open.svg`,
    introUrl: `https://storage.test/${id}.mp3`,
  };
}

const TUTORS = [
  tutor('max', 'Max', ['Sport', 'Natur']),
  tutor('lili', 'Lili', ['Deutsch', 'Lesen']),
  tutor('fina', 'Fina', ['Technik']),
];

interface Overrides {
  interests?: readonly Interest[];
  initialTutorId?: string | null;
  isSaving?: boolean;
  error?: string | null;
}

function setup(overrides: Overrides = {}) {
  const onContinue = vi.fn();
  render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <CompanionStep
        tutors={TUTORS}
        interests={overrides.interests ?? []}
        initialTutorId={overrides.initialTutorId ?? null}
        isSaving={overrides.isSaving ?? false}
        error={overrides.error ?? null}
        onContinue={onContinue}
      />
    </I18nClientProvider>,
  );
  return { onContinue };
}

const listbox = () => screen.getByRole('listbox', { name: 'Companions' });

describe('CompanionStep', () => {
  beforeEach(() => {
    stubMotion(false);
  });

  it("starts with the parent's choice in the middle and offers all companions", () => {
    setup({ initialTutorId: 'lili' });
    expect(screen.getByRole('heading', { name: 'Who helps you?' })).toBeVisible();
    expect(screen.getByRole('option', { selected: true, name: /Lili/ })).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Learn with Lili' })).toBeEnabled();
  });

  it('marks the companions that fit the interests with text, and starts there without a parent choice', () => {
    setup({ interests: ['sports'] });
    expect(screen.getByText('Fits you')).toBeVisible();
    expect(screen.getByRole('option', { selected: true, name: /Max/ })).toHaveTextContent(
      'Fits you',
    );
    expect(screen.getByRole('option', { name: /Lili/ })).not.toHaveTextContent('Fits you');
  });

  it('starts with the first companion when nothing fits and the parent chose none', () => {
    setup({ interests: ['music'] });
    expect(screen.getByRole('option', { selected: true, name: /Max/ })).toBeVisible();
    expect(screen.queryByText('Fits you')).not.toBeInTheDocument();
  });

  it('continues with the companion in the middle after the child moved the carousel', () => {
    const { onContinue } = setup({ initialTutorId: 'max' });
    fireEvent.keyDown(listbox(), { key: 'ArrowRight' });
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent(
      'Lili, 2 of 3, selected',
    );
    fireEvent.click(screen.getByRole('option', { name: /Fina/ }));
    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Learn with Fina' }));
    expect(onContinue).toHaveBeenCalledExactlyOnceWith('fina');
  });

  it('shows only the two first trait words, with no description or long text', () => {
    setup({ initialTutorId: 'lili' });
    expect(screen.getByText('Loyal')).toBeVisible();
    expect(screen.getByText('Encouraging')).toBeVisible();
    expect(screen.queryByText('sportlich')).not.toBeInTheDocument();
    expect(screen.queryByText('Ein Begleiter.')).not.toBeInTheDocument();
  });

  it('changes the traits and the button with the companion in the middle', () => {
    setup({ initialTutorId: 'max' });
    expect(screen.getByRole('button', { name: 'Learn with Max' })).toBeEnabled();
    fireEvent.keyDown(listbox(), { key: 'End' });
    expect(screen.getByRole('button', { name: 'Learn with Fina' })).toBeEnabled();
    expect(screen.getByRole('option', { selected: true, name: /Fina/ })).toBeVisible();
  });

  it('is busy and cannot be sent twice while saving', () => {
    const { onContinue } = setup({ isSaving: true });
    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    fireEvent.click(saving);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('shows a failed save as text, keeps the choice and offers to try again', () => {
    const { onContinue } = setup({ initialTutorId: 'lili', error: 'That didn’t save.' });
    expect(screen.getByRole('alert')).toHaveTextContent('That didn’t save.');
    expect(screen.getByRole('option', { selected: true, name: /Lili/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onContinue).toHaveBeenCalledExactlyOnceWith('lili');
  });
});
