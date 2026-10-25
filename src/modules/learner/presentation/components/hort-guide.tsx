'use client';

import { Hort } from '@components/brand/hort';
import type { HortMood } from '@components/brand/hort';

import { useTranslations } from '@i18n/client';

import type { OnboardingStage } from '../hooks/use-onboarding-flow';

/** How Hort feels at each screen; the words in the bubble say the same, so the face is never alone. */
const MOOD_BY_STAGE = {
  welcome: 'hello',
  child: 'hello',
  interests: 'happy',
  tutor: 'think',
  alexa: 'hello',
  controls: 'hello',
  review: 'think',
  done: 'happy',
} as const satisfies Record<OnboardingStage, HortMood>;

export interface HortGuideProps {
  readonly stage: OnboardingStage;
}

/**
 * Hort beside the steps, with one short sentence about the screen in front of the parent. On every
 * new screen the bubble pops up and Hort hops once, so a step feels like it was noticed. It guides;
 * every instruction a parent needs is also in the card itself.
 */
export function HortGuide({ stage }: HortGuideProps) {
  const t = useTranslations('learner');

  return (
    <div key={stage} className="flex flex-col items-center gap-1">
      <p className="relative flex min-h-20 w-full animate-pop items-center justify-center rounded-token-xl bg-secondary px-5 py-4 text-center text-base font-semibold text-secondary-foreground shadow-soft after:absolute after:-bottom-2 after:left-1/2 after:size-4 after:-translate-x-1/2 after:rotate-45 after:rounded-sm after:bg-secondary after:content-['']">
        {t(`guide.${stage}`)}
      </p>
      <span className="mt-2 inline-block origin-bottom animate-hop">
        <Hort mood={MOOD_BY_STAGE[stage]} isAmbient className="size-36" />
      </span>
    </div>
  );
}
