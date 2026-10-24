'use client';

import { Button } from '@components/ui/button';
import { Play, Quote, Sparkles, Square, Volume2 } from '@components/ui/icons';

import type { CharacterVoice } from '@hooks/use-character-voice';

import { useTranslations } from '@i18n/client';

import type { TutorOption } from './tutor-option';

export interface TutorDetailsProps {
  readonly tutor: TutorOption;
  /** The interests (already translated) this companion fits best, or none. */
  readonly fits: readonly string[];
  readonly voice: CharacterVoice;
}

const BAR_STEP_MS = 150;
const BAR_DELAYS_MS = [0, 1, 2].map((index) => index * BAR_STEP_MS);

/** Three bars that move while the companion speaks: the same news as the mouth, for those who look away. */
function SoundBars() {
  return (
    <span aria-hidden="true" className="flex h-5 items-end gap-0.5">
      {BAR_DELAYS_MS.map((delay) => (
        <span
          key={delay}
          className="h-full w-1 origin-bottom animate-bars rounded-full bg-primary-copy"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * What the parent learns about the chosen companion: how they say hello (as a speech bubble
 * pointing at the figures above), what they are like, and a play button for the stored spoken
 * introduction. The sound never starts by itself. Without a sound file the button is disabled and
 * says so; the companion can still be chosen.
 */
export function TutorDetails({ tutor, fits, voice }: TutorDetailsProps) {
  const t = useTranslations('learner');
  const isPlaying = voice.status === 'playing';

  return (
    <section
      aria-label={tutor.name}
      className="flex flex-col gap-4 rounded-token-xl border border-border bg-surface p-5"
    >
      <p className="relative flex items-start gap-2 rounded-token-xl bg-secondary px-4 py-3 text-secondary-foreground before:absolute before:-top-2 before:left-1/2 before:size-4 before:-translate-x-1/2 before:rotate-45 before:rounded-sm before:bg-secondary before:content-['']">
        <Quote className="mt-1 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="sr-only">{t('tutor.greetingLabel')}: </span>
          <span lang="de" className="font-semibold">
            {tutor.greeting}
          </span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="font-heading text-2xl font-semibold text-copy">{tutor.name}</h3>
        <span lang="de" className="text-copy-muted">
          {tutor.animal}
        </span>
        {fits.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
            <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            {t('tutor.recommended', { topics: fits.join(', ') })}
          </span>
        )}
      </div>
      <p lang="de" className="text-copy">
        {tutor.description}
      </p>
      <ul lang="de" className="flex flex-wrap gap-2">
        {tutor.traits.map((trait) => (
          <li key={trait} className="rounded-full bg-sunken px-3 py-1 text-sm font-semibold">
            {trait}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          type="button"
          size="lg"
          disabled={tutor.introUrl === ''}
          aria-pressed={isPlaying}
          onClick={voice.toggle}
        >
          {isPlaying ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
          {isPlaying ? t('tutor.stop') : t('tutor.play', { name: tutor.name })}
        </Button>
        <p role="status" className="flex items-center gap-2 text-sm text-copy-muted">
          {isPlaying && <SoundBars />}
          {isPlaying && t('tutor.speaking', { name: tutor.name })}
          {voice.status === 'unavailable' && t('tutor.audioUnavailable')}
        </p>
      </div>
      <p className="flex items-start gap-2 text-sm text-copy-muted">
        <Volume2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">{t('tutor.likes')}:</span>{' '}
          <span lang="de">{tutor.topics.join(', ')}</span>
          {' · '}
          <span className="font-semibold">{t('tutor.voice')}:</span>{' '}
          <span lang="de">{tutor.voice}</span>
        </span>
      </p>
    </section>
  );
}
