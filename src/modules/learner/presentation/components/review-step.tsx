'use client';

import type { ReactNode } from 'react';

import { Character } from '@components/brand/character';
import { Button } from '@components/ui/button';
import { Pencil } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useCompleteSetup } from '../hooks/use-complete-setup';

import { StepFrame } from './step-frame';
import { formatMinute } from './time-options';

import type { TutorOption } from './tutor-option';
import type { ChildProfileDto } from '../dto/learner-dto';
import type { OnboardingStage } from '../hooks/use-onboarding-flow';

export interface ReviewStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto;
  readonly tutor: TutorOption | null;
  readonly onBack: () => void;
  readonly onEdit: (stage: OnboardingStage) => void;
  readonly onCompleted: (saved: ChildProfileDto) => void;
}

interface ReviewSectionProps {
  readonly title: string;
  readonly editLabel: string;
  readonly onEdit: () => void;
  readonly children: ReactNode;
}

/** One part of the summary with its own way back to change it. Plain rows, no boxes inside the card. */
function ReviewSection({ title, editLabel, onEdit, children }: ReviewSectionProps) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onEdit}>
          <Pencil aria-hidden="true" />
          {editLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

function ReviewRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <dt className="text-copy-muted">{label}</dt>
      <dd className="font-semibold text-copy">{value}</dd>
    </div>
  );
}

/**
 * Everything the parent chose, read back from what the backend stored, with a way to change each
 * part. Finishing is the only thing left to do: it keeps nothing new, it closes the setup.
 */
export function ReviewStep({
  stepNumber,
  shouldTakeFocus,
  profile,
  tutor,
  onBack,
  onEdit,
  onCompleted,
}: ReviewStepProps) {
  const t = useTranslations('learner');
  const { formError, isPending, onSubmit } = useCompleteSetup(profile, onCompleted);
  const edit = (stage: OnboardingStage) => () => {
    onEdit(stage);
  };
  const window = profile.allowedWindow;

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('review.title')}
      description={t('review.description')}
      onSubmit={onSubmit}
      isPending={isPending}
      formError={formError}
      submitLabel={t('review.submit')}
      onBack={onBack}
    >
      <ReviewSection
        title={t('review.sections.child')}
        editLabel={t('actions.edit')}
        onEdit={edit('child')}
      >
        <dl className="flex flex-col gap-2">
          <ReviewRow label={t('review.rows.name')} value={profile.displayName} />
          <ReviewRow
            label={t('review.rows.state')}
            value={t(`states.${profile.federalState}` as 'states.HE')}
          />
          <ReviewRow
            label={t('review.rows.grade')}
            value={t('child.gradeOption', { grade: profile.grade })}
          />
        </dl>
      </ReviewSection>
      <ReviewSection
        title={t('review.sections.interests')}
        editLabel={t('actions.edit')}
        onEdit={edit('interests')}
      >
        {profile.interests.length === 0 ? (
          <p className="text-copy-muted">{t('review.noInterests')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <li key={interest} className="rounded-full bg-sunken px-3 py-1 text-sm font-semibold">
                {t(`interests.items.${interest}` as 'interests.items.nature')}
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>
      <ReviewSection
        title={t('review.sections.tutor')}
        editLabel={t('actions.edit')}
        onEdit={edit('tutor')}
      >
        {tutor !== null && (
          <p className="flex items-center gap-3">
            <Character
              imageUrl={tutor.imageUrl}
              alt={t('tutor.imageAlt', { name: tutor.name, animal: tutor.animal })}
              className="size-16 overflow-hidden rounded-token bg-surface shadow-soft"
            />
            <span>
              <span className="font-heading text-lg font-semibold">{tutor.name}</span>{' '}
              <span className="text-copy-muted">{tutor.animal}</span>
            </span>
          </p>
        )}
      </ReviewSection>
      <ReviewSection
        title={t('review.sections.controls')}
        editLabel={t('actions.edit')}
        onEdit={edit('controls')}
      >
        <dl className="flex flex-col gap-2">
          <ReviewRow
            label={t('review.rows.voice')}
            value={profile.voiceEnabled ? t('review.values.on') : t('review.values.off')}
          />
          <ReviewRow
            label={t('review.rows.limit')}
            value={
              profile.dailyLimitMinutes === null
                ? t('review.values.none')
                : t('controls.time.limitOption', { minutes: profile.dailyLimitMinutes })
            }
          />
          <ReviewRow
            label={t('review.rows.window')}
            value={
              window === null
                ? t('review.values.anyTime')
                : t('review.values.window', {
                    from: formatMinute(window.fromMinute),
                    until: formatMinute(window.untilMinute),
                  })
            }
          />
          <ReviewRow
            label={t('review.rows.insights')}
            value={profile.learningInsights ? t('review.values.on') : t('review.values.off')}
          />
          <ReviewRow
            label={t('review.rows.guardian')}
            value={profile.guardianConfirmed ? t('review.values.yes') : t('review.values.none')}
          />
        </dl>
      </ReviewSection>
    </StepFrame>
  );
}
