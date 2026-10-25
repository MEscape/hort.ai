'use client';

import { INTEREST_ICONS } from '@modules/learner/client';
import type { Interest } from '@modules/learner/client';

import { Star } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { INTEREST_TINTS } from './interest-tints';

export interface InterestSlotsProps {
  readonly interests: readonly Interest[];
  readonly max: number;
}

/**
 * The places for the favourites as a row of stars: an empty place is a dotted star, a chosen one
 * shows that interest's picture and pops in. It counts without words; a screen reader gets the
 * numbers as text.
 */
export function InterestSlots({ interests, max }: InterestSlotsProps) {
  const t = useTranslations('learner');
  return (
    <div>
      <p role="status" className="sr-only">
        {t('childWelcome.interests.counter', { count: interests.length, max })}
      </p>
      <ul aria-hidden="true" className="flex items-center justify-center gap-3">
        {Array.from({ length: max }, (_, slot) => {
          const interest = interests[slot];
          if (interest === undefined) {
            return (
              <li
                key={`empty-${slot}`}
                className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-border-strong bg-surface/70 text-border-strong"
              >
                <Star className="size-7" />
              </li>
            );
          }
          const Icon = INTEREST_ICONS[interest];
          return (
            <li
              key={interest}
              className={`flex size-14 animate-pop items-center justify-center rounded-full border-2 border-accent shadow-soft ${INTEREST_TINTS[interest]}`}
            >
              <Icon className="size-8" strokeWidth={2.25} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
