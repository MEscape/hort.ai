'use client';

import { Star } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import type { ProgressDto } from '../dto/progress-dto';

const PERCENT = 100;

type Translate = ReturnType<typeof useTranslations<'progression'>>;

/** The progress inside the current level as words: the progressbar's text alternative. */
function progressText(progress: ProgressDto, t: Translate): string {
  return progress.xpForNextLevel === null
    ? t('meter.max')
    : t('meter.toNext', {
        current: progress.xpIntoLevel,
        total: progress.xpForNextLevel,
        next: progress.level + 1,
      });
}

function milestoneKey(isCurrent: boolean, isReached: boolean) {
  if (isCurrent) {
    return 'meter.levelCurrent';
  }
  return isReached ? 'meter.levelReached' : 'meter.levelAhead';
}

/** One star per level: filled when reached, bigger and ringed for the current one, hollow ahead. */
function Milestones({ progress }: { readonly progress: ProgressDto }) {
  const t = useTranslations('progression');
  const levels = Array.from({ length: progress.maxLevel }, (_, index) => index + 1);

  return (
    <ol aria-label={t('meter.levelsLabel')} className="flex items-center justify-between px-1">
      {levels.map((level) => {
        const isCurrent = level === progress.level;
        const isReached = level < progress.level;
        return (
          <li key={level} className="flex size-6 items-center justify-center">
            <span className="sr-only">{t(milestoneKey(isCurrent, isReached), { level })}</span>
            <Star
              aria-hidden="true"
              className={cn(
                'transition-transform duration-300 ease-spring',
                isCurrent && 'size-6 fill-accent text-primary',
                isReached && 'size-4 fill-accent text-accent-copy',
                !isCurrent && !isReached && 'size-4 fill-transparent text-border-strong',
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}

export interface LevelMeterProps {
  readonly progress: ProgressDto;
  readonly className?: string;
}

/**
 * Where the child stands, from the stored events: a big star with the level, a thick bar for the
 * way to the next level and one small star per level (filled when reached, never colour alone: the
 * current one is bigger and ringed). The bar is a real progressbar with a text alternative. It only
 * draws what the server said: when the numbers change, the fill slides (transform only).
 */
export function LevelMeter({ progress, className }: LevelMeterProps) {
  const t = useTranslations('progression');
  const text = progressText(progress, t);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-token-xl border-2 border-border bg-surface px-3 py-2 shadow-soft',
        className,
      )}
    >
      <span
        key={progress.level}
        data-level-badge=""
        className="relative flex size-14 shrink-0 animate-pop items-center justify-center"
      >
        <Star
          aria-hidden="true"
          strokeWidth={1.75}
          className="absolute inset-0 size-full fill-accent text-primary drop-shadow-sm"
        />
        <span
          aria-hidden="true"
          className="relative pt-0.5 font-heading text-xl font-bold text-accent-foreground"
        >
          {progress.level}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-heading text-xl font-semibold">
            {t('meter.level', { level: progress.level })}
          </p>
          {progress.xpForNextLevel !== null && (
            <p
              aria-hidden="true"
              className="flex items-center gap-1 text-sm font-semibold text-copy-muted"
            >
              {progress.xpIntoLevel}/{progress.xpForNextLevel}
              <Star className="size-4 fill-accent text-accent-copy" />
            </p>
          )}
        </div>
        <div
          role="progressbar"
          aria-label={t('meter.label')}
          aria-valuemin={0}
          aria-valuemax={PERCENT}
          aria-valuenow={Math.round(progress.fraction * PERCENT)}
          aria-valuetext={t('meter.valueText', { level: progress.level, progress: text })}
          className="h-3.5 overflow-hidden rounded-full border-2 border-border-strong bg-sunken"
        >
          <div
            key={progress.level}
            className="h-full origin-left rounded-full bg-accent transition-transform duration-700 ease-soft"
            style={{ transform: `scaleX(${progress.fraction})` }}
          />
        </div>
        <Milestones progress={progress} />
      </div>
    </div>
  );
}
