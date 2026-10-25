'use client';

import type { Interest, TutorOption } from '@modules/learner/client';

import { CharacterCarousel } from '@components/shared/character-carousel';

import { useTranslations } from '@i18n/client';

import { CompanionTraits } from './companion-traits';
import { StepButton } from './step-button';
import { StepScene } from './step-scene';
import { useCompanionChoice } from './use-companion-choice';

export interface CompanionStepProps {
  readonly tutors: readonly TutorOption[];
  /** The child's interests: companions that share them carry a star "fits you". */
  readonly interests: readonly Interest[];
  /** The parent's choice, in the middle at first; `null` when the parent skipped it. */
  readonly initialTutorId: string | null;
  /** True while the choice is being saved. */
  readonly isSaving: boolean;
  /** Why the last save failed, or `null`; the choice stays and the button tries again. */
  readonly error: string | null;
  readonly onContinue: (tutorId: string) => void;
}

/**
 * Step 3: meet the companions and pick one by swiping, the arrow keys, the two big buttons or a
 * tap on a neighbour. The one in the middle is the choice; it is saved only by the big button,
 * which names it, so nothing is claimed before the child decided. Persisting is the flow's job.
 */
export function CompanionStep({
  tutors,
  interests,
  initialTutorId,
  isSaving,
  error,
  onContinue,
}: CompanionStepProps) {
  const t = useTranslations('learner');
  const { characters, activeId, setActiveId, active } = useCompanionChoice({
    tutors,
    interests,
    initialTutorId,
    fitBadge: t('welcomeCompanion.companion.fits'),
  });

  return (
    <StepScene
      title={t('welcomeCompanion.companion.title')}
      error={error ?? undefined}
      footer={
        active !== undefined && (
          <StepButton
            label={
              error === null
                ? t('welcomeCompanion.companion.choose', { name: active.name })
                : t('childWelcome.actions.retry')
            }
            isPending={isSaving}
            onClick={() => {
              onContinue(active.id);
            }}
          />
        )
      }
    >
      <CharacterCarousel
        characters={characters}
        activeId={activeId}
        onActiveChange={setActiveId}
        labels={{
          group: t('welcomeCompanion.companion.group'),
          previous: t('welcomeCompanion.companion.previous'),
          next: t('welcomeCompanion.companion.next'),
          selected: (name, position, total) =>
            t('welcomeCompanion.companion.selected', { name, position, total }),
        }}
      />
      {active !== undefined && <CompanionTraits key={active.id} traits={active.traits} />}
    </StepScene>
  );
}
