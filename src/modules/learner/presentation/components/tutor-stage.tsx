'use client';

import { Button } from '@components/ui/button';
import { Play, Quote, Square, Volume2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useTutorIntro } from '../hooks/use-tutor-intro';

import { TutorAvatar } from './tutor-avatar';

import type { TutorOption } from './tutor-option';

export interface TutorStageProps {
  readonly tutor: TutorOption;
}

/**
 * The chosen companion up close: a big picture whose mouth moves while the spoken introduction
 * plays, what they are like, and how they say hello. Play is a real button; the introduction never
 * starts by itself. Without a sound file the button is disabled and says so; the companion can still
 * be chosen. The stage is keyed by companion, so switching stops the sound.
 */
export function TutorStage({ tutor }: TutorStageProps) {
  const t = useTranslations('learner');
  const intro = useTutorIntro(tutor.introUrl);
  const isPlaying = intro.status === 'playing';
  const isUnavailable = intro.status === 'unavailable' || tutor.introUrl === '';

  return (
    <section
      aria-label={tutor.name}
      className="flex flex-col gap-5 rounded-token-xl border border-border bg-highlight/70 p-5 sm:flex-row sm:items-start"
    >
      <TutorAvatar
        imageUrl={tutor.imageUrl}
        openImageUrl={intro.hasStarted ? tutor.imageOpenUrl : undefined}
        isMouthOpen={intro.isMouthOpen}
        tone={tutor.tone}
        alt={t('tutor.imageAlt', { name: tutor.name, animal: tutor.animal })}
        className="size-44 self-center sm:size-52 sm:self-start"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-heading text-2xl font-semibold text-copy">{tutor.name}</span>
          <span lang="de" className="text-copy-muted">
            {tutor.animal}
          </span>
        </p>
        <p lang="de" className="text-copy">
          {tutor.description}
        </p>
        <ul lang="de" className="flex flex-wrap gap-2">
          {tutor.traits.map((trait) => (
            <li key={trait} className="rounded-full bg-surface px-3 py-1 text-sm font-semibold">
              {trait}
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 rounded-token bg-secondary/60 px-3 py-2 text-secondary-foreground">
          <Quote className="mt-1 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="sr-only">{t('tutor.greetingLabel')}: </span>
            <span lang="de">{tutor.greeting}</span>
          </span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={tutor.introUrl === ''}
            aria-pressed={isPlaying}
            onClick={intro.toggle}
          >
            {isPlaying ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
            {isPlaying ? t('tutor.stop') : t('tutor.play', { name: tutor.name })}
          </Button>
          <p role="status" className="text-sm text-copy-muted">
            {isPlaying && t('tutor.speaking', { name: tutor.name })}
            {isUnavailable && t('tutor.audioUnavailable')}
          </p>
        </div>
        <p className="flex items-start gap-2 text-sm text-copy-muted">
          <Volume2 className="mt-0.5 size-4 shrink-0 text-secondary-copy" aria-hidden="true" />
          <span>
            <span className="font-semibold">{t('tutor.voice')}:</span>{' '}
            <span lang="de">{tutor.voice}</span>
          </span>
        </p>
      </div>
    </section>
  );
}
