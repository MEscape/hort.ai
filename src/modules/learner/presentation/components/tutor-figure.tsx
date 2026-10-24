'use client';

import { useState } from 'react';
import type { ComponentProps } from 'react';

import { Character } from '@components/brand/character';
import { Check, Sparkles } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import type { TutorOption } from './tutor-option';

export interface TutorFigureProps {
  readonly tutor: TutorOption;
  readonly isSelected: boolean;
  /** True while this companion's introduction plays: its mouth moves. */
  readonly isSpeaking: boolean;
  /** The interests (already translated) this companion fits best, or none. */
  readonly fits: readonly string[];
  /** Spread from `register`: name, ref, onChange and onBlur of the radio group. */
  readonly radioProps: Omit<ComponentProps<'input'>, 'type' | 'value'>;
}

/**
 * One companion standing in the stage. The picture is bigger than its spot and rises above the
 * box on purpose, so the companions feel like they are standing in front of it. A tap makes the
 * companion hop once, the chosen one grows a little, and a hover only enlarges the others slightly. Only
 * transforms and opacity animate, and calm mode turns all of it off. A native radio keeps arrow
 * keys and screen-reader grouping; the whole figure is the target; the chosen one is marked by size,
 * a filled name AND a tick, never by colour alone.
 */
export function TutorFigure({ tutor, isSelected, isSpeaking, fits, radioProps }: TutorFigureProps) {
  const t = useTranslations('learner');
  const [hops, setHops] = useState(0);

  return (
    // @ui-plain label The whole figure is the radio's label: it holds the picture and the name.
    <label className="group relative flex w-20 cursor-pointer flex-col items-center sm:w-36">
      {/* @ui-plain input A native radio keeps arrow keys and grouping; the figure next to it is the visible control. */}
      <input
        type="radio"
        value={tutor.id}
        className="peer sr-only"
        onClick={() => {
          setHops((count) => count + 1);
        }}
        {...radioProps}
      />
      {fits.length > 0 && (
        <span className="sr-only">{t('tutor.recommended', { topics: fits.join(', ') })}</span>
      )}
      <span
        className={cn(
          '-mt-9 block origin-bottom transition-transform duration-300 ease-spring sm:-mt-14',
          isSelected ? 'z-10 scale-110 sm:scale-125' : 'scale-100 group-hover:scale-105',
        )}
      >
        <span key={hops} className={cn('block origin-bottom', hops > 0 && 'animate-hop')}>
          <span className="block origin-bottom">
            <Character
              imageUrl={tutor.imageUrl}
              openImageUrl={isSelected ? tutor.imageOpenUrl : undefined}
              isSpeaking={isSelected && isSpeaking}
              alt=""
              className="size-20 sm:size-36"
            />
          </span>
        </span>
      </span>
      {fits.length > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-1 flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-soft sm:top-2"
        >
          <Sparkles className="size-4" />
        </span>
      )}
      <span
        className={cn(
          'mt-2 flex items-center gap-1.5 rounded-full px-3 py-1 font-heading text-base font-semibold transition-colors duration-150 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-copy',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-surface text-copy',
        )}
      >
        {isSelected && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
        {tutor.name}
      </span>
    </label>
  );
}
