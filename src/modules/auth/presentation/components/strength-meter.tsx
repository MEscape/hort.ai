'use client';

import { Star } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { STRENGTH } from '../password/password-strength';

import type { StrengthLevel } from '../password/password-strength';

const LEVEL_KEYS = {
  1: 'passwordGuidance.strength.weak',
  2: 'passwordGuidance.strength.fair',
  3: 'passwordGuidance.strength.good',
  4: 'passwordGuidance.strength.strong',
} as const;

const SEGMENTS = [STRENGTH.weak, STRENGTH.fair, STRENGTH.good, STRENGTH.strong] as const;

/** The word's colour: gentle for a start, green once it is good. Never a child-facing "error" red. */
const TEXT = {
  1: 'text-nudge',
  2: 'text-warning',
  3: 'text-success',
  4: 'text-success',
} as const;

export interface StrengthMeterProps {
  readonly level: StrengthLevel;
}

/**
 * Four stars that light up as the password grows, and a word. The word is the live region: it
 * changes only when the level does, so a screen reader hears "Strength: Good" once, not on every
 * key. The stars are decoration (filled versus outlined differ by shape, not only by colour).
 */
export function StrengthMeter({ level }: StrengthMeterProps) {
  const t = useTranslations('auth');

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden="true" className="flex gap-1.5">
        {SEGMENTS.map((segment) => (
          <Star
            key={segment}
            className={cn(
              'size-7 transition-colors duration-200',
              level >= segment
                ? 'animate-pop fill-accent stroke-accent-copy'
                : 'fill-transparent stroke-border-strong',
            )}
          />
        ))}
      </div>
      <p
        role="status"
        className={cn('text-base font-semibold', level === 0 ? 'text-copy-muted' : TEXT[level])}
      >
        {level === 0
          ? t('passwordGuidance.empty')
          : t('passwordGuidance.strengthLabel', { level: t(LEVEL_KEYS[level]) })}
      </p>
    </div>
  );
}
