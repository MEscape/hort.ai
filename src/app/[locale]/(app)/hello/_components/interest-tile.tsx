'use client';

import { INTEREST_ICONS } from '@modules/learner/client';
import type { Interest } from '@modules/learner/client';

import { Check } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { INTEREST_TINTS } from './interest-tints';

import type { TileFeedback } from './use-interest-choice';

export interface InterestTileProps {
  readonly interest: Interest;
  readonly isSelected: boolean;
  /** True when every place is taken and this one is not chosen: dimmed, still tappable (it shakes). */
  readonly isBlocked: boolean;
  readonly isDisabled: boolean;
  readonly feedback: TileFeedback | null;
  readonly onToggle: (interest: Interest) => void;
  readonly onFeedbackEnd: () => void;
}

/**
 * A big picture to tap. Chosen: a tick, a thick outline and a bigger tile (never colour alone).
 * Blocked: dimmed and grey, `aria-disabled`, and a tap shakes it a little instead of choosing it.
 * It stays a focusable button, so a keyboard child hears why and is never trapped.
 */
export function InterestTile({
  interest,
  isSelected,
  isBlocked,
  isDisabled,
  feedback,
  onToggle,
  onFeedbackEnd,
}: InterestTileProps) {
  const t = useTranslations('learner');
  const Icon = INTEREST_ICONS[interest];
  const own = feedback?.interest === interest ? feedback.kind : null;

  return (
    // @ui-plain button A picture tile with a tick and its own hop and shake; Button is a text pill.
    <button
      type="button"
      aria-pressed={isSelected}
      aria-disabled={isBlocked || undefined}
      disabled={isDisabled}
      onClick={() => {
        onToggle(interest);
      }}
      onAnimationEnd={(event) => {
        // The tick's own pop bubbles up here too; only the tile's animation ends the feedback.
        if (event.target === event.currentTarget) {
          onFeedbackEnd();
        }
      }}
      className={cn(
        'relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-token-xl border-2 px-2 py-3 font-heading text-xl font-semibold text-copy shadow-soft transition-[transform,opacity] duration-200 ease-spring disabled:opacity-60',
        isSelected ? 'scale-105 border-primary bg-highlight' : 'border-border bg-surface',
        isBlocked && 'opacity-45 grayscale',
        own === 'hop' && 'motion-safe:animate-hop',
        own === 'refused' && 'motion-safe:animate-wobble',
      )}
    >
      <span
        className={cn(
          'flex size-16 items-center justify-center rounded-full',
          INTEREST_TINTS[interest],
        )}
      >
        <Icon className="size-9" strokeWidth={2.25} aria-hidden="true" />
      </span>
      {t(`interests.items.${interest}`)}
      {isSelected && (
        <span
          aria-hidden="true"
          className="absolute -top-2 -right-2 flex size-8 animate-pop items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
        >
          <Check className="size-5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
