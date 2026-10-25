import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TutorOption } from '@modules/learner/client';
import en from '@modules/learner/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { VoiceStep } from '@/app/[locale]/(app)/hello/_components/voice-step';
import app from '@/i18n/messages/en.json';

import {
  FakeAudio,
  soundsPlaying,
  stubAudio,
  stubMotion,
} from '../../components/shared/fake-audio';

const MAX: TutorOption = {
  id: 'max',
  name: 'Max',
  animal: 'Hund',
  description: 'Ein Begleiter.',
  traits: ['treu'],
  topics: ['Sport'],
  greeting: 'Wuff, hallo! Ich bin Max.',
  voice: 'freundlich, kräftig, fröhlich, laut (Jungenstimme)',
  imageUrl: '/max.svg',
  imageOpenUrl: '/max-open.svg',
  introUrl: 'https://storage.test/max.mp3',
};

function setup(tutor: TutorOption = MAX, voiceAllowed = true) {
  const onContinue = vi.fn();
  const view = render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <VoiceStep tutor={tutor} voiceAllowed={voiceAllowed} onContinue={onContinue} />
    </I18nClientProvider>,
  );
  return { onContinue, ...view };
}

describe('VoiceStep', () => {
  beforeEach(() => {
    stubAudio();
    stubMotion(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the catalog words, marked German, for a companion nobody translated yet', () => {
    setup({ ...MAX, id: 'neu', voice: 'ruhig, warm (Stimme)' });
    expect(screen.getByText('ruhig, warm').closest('[lang]')).toHaveAttribute('lang', 'de');
  });

  it('shows how the voice sounds in three words, and plays nothing by itself', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Listen!' })).toBeVisible();
    expect(screen.getByText('Friendly, strong, cheerful')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeEnabled();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('keeps what the recording says for a screen reader, not on the screen as prose', () => {
    setup();
    expect(screen.getByText('Wuff, hallo! Ich bin Max.').closest('p')).toHaveClass('sr-only');
  });

  it('plays when the companion itself is tapped, once', () => {
    setup();
    const picture = document.querySelector('button[aria-hidden="true"]');
    fireEvent.click(picture as HTMLElement);
    expect(FakeAudio.instances.map(({ url }) => url)).toEqual(['https://storage.test/max.mp3']);
    expect(soundsPlaying()).toBe(1);
  });

  it("plays the companion's stored introduction on a press and stops it again", () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Hear Max' }));
    expect(FakeAudio.instances.map(({ url }) => url)).toEqual(['https://storage.test/max.mp3']);
    act(() => {
      FakeAudio.instances[0]?.onplaying?.();
    });
    expect(screen.getByText('Max is speaking…')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(soundsPlaying()).toBe(0);
  });

  it('shows a small muted chip only when the parent switched talking out loud off', () => {
    const { unmount } = setup(MAX, true);
    expect(screen.queryByText('Talking off')).not.toBeInTheDocument();
    unmount();
    setup(MAX, false);
    expect(screen.getByText('Talking off')).toBeVisible();
    // The preview is a stored recording, so it plays either way.
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeEnabled();
  });

  it('can still go on when there is no sound file', () => {
    const { onContinue } = setup({ ...MAX, introUrl: '' });
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeDisabled();
    expect(screen.getByText('No sound right now. Carry on!')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('stops the sound when the child leaves the step', () => {
    const { unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Hear Max' }));
    expect(soundsPlaying()).toBe(1);
    unmount();
    expect(soundsPlaying()).toBe(0);
  });
});
