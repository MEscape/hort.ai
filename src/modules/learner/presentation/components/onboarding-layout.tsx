'use client';

import type { ReactNode } from 'react';

import { HortGuide } from './hort-guide';
import { OnboardingStepper } from './onboarding-stepper';

import type { OnboardingStage } from '../hooks/use-onboarding-flow';

export interface OnboardingLayoutProps {
  readonly stage: OnboardingStage;
  readonly stepNumber: number;
  readonly children: ReactNode;
}

/**
 * The journey: on a wide screen Hort and the list of steps stay on the left while the current step
 * is in front on the right; on a phone the steps shrink to one progress bar above the card.
 */
export function OnboardingLayout({ stage, stepNumber, children }: OnboardingLayoutProps) {
  return (
    <div className="flex w-full flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:w-80 lg:shrink-0">
        <div className="hidden lg:block">
          <HortGuide stage={stage} />
        </div>
        <OnboardingStepper stage={stage} stepNumber={stepNumber} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
