'use client';

import type { ComponentProps } from 'react';

import { Quote, Sparkles, Volume2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { TutorAvatar } from './tutor-avatar';

import type { TutorOption } from './tutor-option';

export interface TutorChoiceProps {
  readonly tutor: TutorOption;
  /** The interests (already translated) this companion fits, or none. */
  readonly fits: readonly string[];
  /** Spread from `register`: name, ref, onChange and onBlur of the radio group. */
  readonly radioProps: Omit<ComponentProps<'input'>, 'type' | 'value'>;
}

/**
 * One companion as a big selectable card: picture, name and radio on top, then how they help, what
 * they like, their voice in words, and how they say hello. A native radio keeps arrow-key movement
 * and screen-reader grouping; the whole card is the target, and the chosen card is marked by its
 * border, its tint AND the filled radio. The catalog text is German, because the companion speaks
 * German with the child: it is marked `lang="de"` so a screen reader pronounces it right. The voice is
 * described, not played: no speech exists yet.
 */
export function TutorChoice({ tutor, fits, radioProps }: TutorChoiceProps) {
  const t = useTranslations('learner');

  return (
    // @ui-plain label The whole card is the radio's label: it holds picture, text and badges.
    <label className="flex cursor-pointer flex-col gap-3 rounded-token-lg border-2 border-border-strong bg-surface p-4 transition-[border-color,background-color] duration-150 hover:border-primary-copy has-checked:border-primary-copy has-checked:bg-highlight has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-copy has-disabled:opacity-60">
      <span className="flex items-center gap-4">
        <TutorAvatar
          imageUrl={tutor.imageUrl}
          tone={tutor.tone}
          alt={t('tutor.imageAlt', { name: tutor.name, animal: tutor.animal })}
          className="size-16 sm:size-20"
        />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-heading text-xl font-semibold text-copy">{tutor.name}</span>
          <span lang="de" className="text-copy-muted">
            {tutor.animal}
          </span>
          {fits.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
              {t('tutor.recommended', { topics: fits.join(', ') })}
            </span>
          )}
        </span>
        {/* @ui-plain input A native radio keeps arrow keys and grouping; the card around it is the visible control. */}
        <input
          type="radio"
          value={tutor.id}
          className="size-6 shrink-0 accent-primary focus-visible:outline-none!"
          {...radioProps}
        />
      </span>
      <span lang="de" className="text-copy">
        {tutor.description}
      </span>
      <span lang="de" className="flex flex-wrap gap-2">
        {tutor.traits.map((trait) => (
          <span
            key={trait}
            className="rounded-full bg-sunken px-3 py-1 text-sm font-semibold text-copy"
          >
            {trait}
          </span>
        ))}
      </span>
      <span className="hidden text-sm text-copy-muted sm:block">
        <span className="font-semibold">{t('tutor.likes')}:</span>{' '}
        <span lang="de">{tutor.topics.join(', ')}</span>
      </span>
      <span className="hidden items-center gap-2 text-sm text-copy-muted sm:flex">
        <Volume2 className="size-4 shrink-0 text-secondary-copy" aria-hidden="true" />
        <span>
          <span className="font-semibold">{t('tutor.voice')}:</span>{' '}
          <span lang="de">{tutor.voice}</span>
        </span>
      </span>
      <span className="flex items-start gap-2 rounded-token bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
        <Quote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="sr-only">{t('tutor.greetingLabel')}: </span>
          <span lang="de">{tutor.greeting}</span>
        </span>
      </span>
    </label>
  );
}
