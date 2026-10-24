'use client';

import { useOnboardingFlow } from '../hooks/use-onboarding-flow';
import { useStageContext } from '../hooks/use-stage-context';

import { ChildProfileStep } from './child-profile-step';
import { ControlsStep } from './controls-step';
import { DoneStep } from './done-step';
import { InterestsStep } from './interests-step';
import { OnboardingLayout } from './onboarding-layout';
import { ReviewStep } from './review-step';
import { TutorStep } from './tutor-step';
import { WelcomeStep } from './welcome-step';

import type { TutorOption } from './tutor-option';
import type { OnboardingStateDto } from '../dto/learner-dto';
import type { StageContext } from '../hooks/use-stage-context';

export interface OnboardingFlowProps {
  /** Where the backend says the parent stands; a visit resumes there. */
  readonly initial: OnboardingStateDto;
  /** The companions that can be chosen, prepared by the page from the tutor catalog. */
  readonly tutors: readonly TutorOption[];
}

interface StageProps {
  readonly context: StageContext;
  readonly tutors: readonly TutorOption[];
}

/** The screen of the current stage. Every stage after the welcome and the child needs the saved profile. */
function CurrentStage({ context, tutors }: StageProps) {
  const { common, stage, profile, tutor, back } = context;

  if (stage === 'child') {
    return (
      <ChildProfileStep
        {...common}
        profile={profile}
        onBack={back}
        onSaved={context.savedThen('interests')}
      />
    );
  }
  if (profile === null || stage === 'welcome') {
    return <WelcomeStep {...common} onStart={context.start} />;
  }
  switch (stage) {
    case 'interests':
      return (
        <InterestsStep
          {...common}
          profile={profile}
          onBack={back}
          onSaved={context.savedThen('tutor')}
        />
      );
    case 'tutor':
      return (
        <TutorStep
          {...common}
          profile={profile}
          tutors={tutors}
          onBack={back}
          onSaved={context.savedThen('controls')}
        />
      );
    case 'controls':
      return (
        <ControlsStep
          {...common}
          profile={profile}
          onBack={back}
          onSaved={context.savedThen('review')}
        />
      );
    case 'review':
      return (
        <ReviewStep
          {...common}
          profile={profile}
          tutor={tutor}
          onBack={back}
          onEdit={context.edit}
          onCompleted={context.savedThen('done')}
        />
      );
    default:
      return <DoneStep {...common} profile={profile} tutor={tutor} />;
  }
}

/**
 * The parent's setup: welcome, child, interests, companion, controls, review, done. Each screen is
 * left only after the backend stored it, and a visit resumes at the first step that is still open.
 */
export function OnboardingFlow({ initial, tutors }: OnboardingFlowProps) {
  const flow = useOnboardingFlow(initial);
  const context = useStageContext(flow, tutors);

  return (
    <OnboardingLayout stage={flow.stage} stepNumber={flow.stepNumber}>
      <CurrentStage context={context} tutors={tutors} />
    </OnboardingLayout>
  );
}
