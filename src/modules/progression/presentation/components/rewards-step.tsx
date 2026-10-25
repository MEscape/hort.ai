'use client';

import { Button } from '@components/ui/button';

import { useFocusOnMount } from '@hooks/use-focus-on-mount';

import { useTranslations } from '@i18n/client';

import { useFeedGame } from '../hooks/use-feed-game';

import { FeedStage } from './feed-stage';

import type { CompanionVisual } from './companion-visual';
import type { ProgressDto } from '../dto/progress-dto';

export interface RewardsStepProps {
  readonly initial: ProgressDto;
  readonly companion: CompanionVisual;
  readonly onContinue: () => void;
}

/**
 * Step 5 of the child's welcome: feed the companion (today's star) and watch the real level meter.
 * Every number comes from the server (the page's `initial`, then the claim's answer); the animations
 * only show what was confirmed. Feeding is optional: Continue is always available, also while a
 * claim is on its way or after it failed. The way back is the welcome's own round button.
 */
export function RewardsStep({ initial, companion, onContinue }: RewardsStepProps) {
  const t = useTranslations('progression');
  const game = useFeedGame(initial);
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);

  return (
    <section className="flex flex-1 flex-col gap-3">
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {t('feed.title')}
      </h1>
      <div className="flex flex-1 flex-col justify-center">
        <FeedStage
          game={game}
          companion={companion}
          avatarClassName="size-[min(40dvh,86vw,24rem)]"
        />
      </div>
      <div className="sticky bottom-0 z-20 flex justify-center pt-2 pb-safe">
        {/* Same look as the welcome's StepButton on every other step, so "on" never moves or changes colour. */}
        <Button
          type="button"
          size="lg"
          variant="accent"
          className="h-16 w-full max-w-md rounded-full px-10 text-2xl shadow-lift active:translate-y-0.5"
          onClick={onContinue}
        >
          {t('feed.continue')}
        </Button>
      </div>
    </section>
  );
}
