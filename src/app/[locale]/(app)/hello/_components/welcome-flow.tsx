'use client';

import type { ChildProfileDto, TutorOption } from '@modules/learner/client';
import { RewardsStep } from '@modules/progression/client';
import type { ProgressDto } from '@modules/progression/client';

import { useTranslations } from '@i18n/client';

import { CelebrationStep } from './celebration-step';
import { CompanionStep } from './companion-step';
import { InterestsStep } from './interests-step';
import { COMPANION_STAGES, useWelcomeFlow } from './use-welcome-flow';
import { VoiceStep } from './voice-step';
import { WelcomeShell } from './welcome-shell';
import { WelcomeStep } from './welcome-step';

export interface WelcomeFlowProps {
  /** The child as stored: the choices the parent made, which the child may change once. */
  readonly profile: ChildProfileDto;
  /** The companions that can be chosen, prepared by the page from the tutor catalog. */
  readonly tutors: readonly TutorOption[];
  /** The real progress read on the server, for the companion's mood and the levels step. */
  readonly progress: ProgressDto;
}

interface StageViewProps extends WelcomeFlowProps {
  readonly flow: ReturnType<typeof useWelcomeFlow>;
  readonly tutor: TutorOption | null;
}

/** The screens after the companion was chosen: they speak about, with and for that companion. */
function CompanionStages({
  flow,
  profile,
  progress,
  tutor,
}: StageViewProps & { tutor: TutorOption }) {
  const t = useTranslations('learner');
  if (flow.stage === 'voice') {
    return <VoiceStep tutor={tutor} voiceAllowed={profile.voiceEnabled} onContinue={flow.next} />;
  }
  if (flow.stage === 'rewards') {
    return <RewardsStep initial={progress} companion={tutor} onContinue={flow.next} />;
  }
  return (
    <CelebrationStep
      name={profile.displayName}
      tutor={tutor}
      isSaving={flow.isSaving}
      error={flow.hasError ? t('childWelcome.saveError') : undefined}
      onFinish={flow.complete}
    />
  );
}

/** The screen of the current stage; without a known companion the child picks one first. */
function StageView(props: StageViewProps) {
  const { flow, profile, tutors, progress, tutor } = props;
  const t = useTranslations('learner');
  if (tutor !== null && COMPANION_STAGES.includes(flow.stage)) {
    return <CompanionStages {...props} tutor={tutor} />;
  }

  switch (COMPANION_STAGES.includes(flow.stage) ? 'companion' : flow.stage) {
    case 'welcome':
      return (
        <WelcomeStep
          name={profile.displayName}
          tutor={tutor}
          progress={progress}
          onStart={flow.next}
        />
      );
    case 'interests':
      return (
        <InterestsStep
          interests={flow.interests}
          tutor={tutor}
          progress={progress}
          onChange={flow.setInterests}
          isSaving={flow.isSaving}
          hasError={flow.hasError}
          onContinue={flow.saveInterests}
        />
      );
    default:
      return (
        <CompanionStep
          tutors={tutors}
          interests={flow.interests}
          initialTutorId={flow.tutorId}
          isSaving={flow.isSaving}
          error={flow.hasError ? t('childWelcome.saveError') : null}
          onContinue={flow.chooseTutor}
        />
      );
  }
}

/**
 * The child's one-time welcome: hello, interests, companion, voice, levels and the end. Interests
 * come strictly before the companion (the companion step recommends from them). The stored profile
 * is the truth; a reload starts again from hello with whatever was already saved.
 */
export function WelcomeFlow(props: WelcomeFlowProps) {
  const flow = useWelcomeFlow(props.profile);
  const tutor = props.tutors.find((option) => option.id === flow.tutorId) ?? null;

  return (
    <WelcomeShell
      index={flow.index}
      direction={flow.direction}
      isBusy={flow.isSaving}
      onBack={flow.back}
    >
      <StageView {...props} flow={flow} tutor={tutor} />
    </WelcomeShell>
  );
}
