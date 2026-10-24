'use client';

import type { ComponentProps } from 'react';

import { Check, Sparkles } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { TutorAvatar } from './tutor-avatar';

import type { TutorOption } from './tutor-option';

export interface TutorTileProps {
  readonly tutor: TutorOption;
  /** The interests (already translated) this companion fits best, or none. */
  readonly fits: readonly string[];
  /** Spread from `register`: name, ref, onChange and onBlur of the radio group. */
  readonly radioProps: Omit<ComponentProps<'input'>, 'type' | 'value'>;
}

/**
 * One companion as a big picture tile in a row the parent can swipe through. A native radio under
 * the tile keeps arrow-key movement and screen-reader grouping; the whole tile is the target. The
 * chosen tile is marked by its border, its tint AND a tick, never by colour alone.
 */
export function TutorTile({ tutor, fits, radioProps }: TutorTileProps) {
  const t = useTranslations('learner');

  return (
    // @ui-plain label The whole tile is the radio's label: it holds the picture, the name and a badge.
    <label className="relative block w-44 shrink-0 cursor-pointer snap-center sm:w-auto">
      {/* @ui-plain input A native radio keeps arrow keys and grouping; the tile next to it is the visible control. */}
      <input type="radio" value={tutor.id} className="peer sr-only" {...radioProps} />
      <span className="flex h-full flex-col items-center gap-2 rounded-token-xl border-2 border-border-strong bg-surface p-4 text-center transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary-copy peer-checked:border-primary-copy peer-checked:bg-highlight peer-checked:shadow-lift peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-copy peer-disabled:opacity-60">
        <TutorAvatar
          imageUrl={tutor.imageUrl}
          tone={tutor.tone}
          alt=""
          className="size-28 sm:size-32"
        />
        <span className="font-heading text-xl font-semibold text-copy">{tutor.name}</span>
        <span lang="de" className="text-copy-muted">
          {tutor.animal}
        </span>
        {fits.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
            <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            {t('tutor.recommended', { topics: fits.join(', ') })}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="absolute top-3 right-3 hidden size-7 items-center justify-center rounded-full bg-primary text-primary-foreground peer-checked:flex"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </label>
  );
}
