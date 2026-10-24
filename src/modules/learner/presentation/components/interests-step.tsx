'use client';

import { Controller } from 'react-hook-form';

import { Button } from '@components/ui/button';
import { Check } from '@components/ui/icons';
import { ToggleGroup, ToggleGroupItem } from '@components/ui/toggle-group';

import { useTranslations } from '@i18n/client';

import { INTERESTS, LEARNER_LIMITS } from '../../application/contracts/learner-constraints';
import { useInterestsForm } from '../hooks/use-interests-form';

import { INTEREST_ICONS } from './interest-icons';
import { StepFrame } from './step-frame';

import type { ChildProfileDto } from '../dto/learner-dto';

export interface InterestsStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto;
  readonly onBack: () => void;
  readonly onSaved: (saved: ChildProfileDto) => void;
}

/**
 * Up to a few things the child enjoys, from a fixed list with a picture each. Nothing here is
 * required: "skip" sends an empty choice. The chips are real toggle buttons, so a keyboard and a
 * screen reader know which are pressed, and the count is said aloud as it changes.
 */
export function InterestsStep({
  stepNumber,
  shouldTakeFocus,
  profile,
  onBack,
  onSaved,
}: InterestsStepProps) {
  const t = useTranslations('learner');
  const { form, errorText, formError, isPending, onSubmit } = useInterestsForm(profile, onSaved);
  const max = LEARNER_LIMITS.maxInterests;

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('interests.title', { name: profile.displayName })}
      description={t('interests.description', { max })}
      onSubmit={onSubmit}
      isPending={isPending}
      formError={formError ?? errorText(form.formState.errors.interests?.message)}
      submitLabel={t('interests.submit')}
      onBack={onBack}
      secondary={
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            form.setValue('interests', []);
            void onSubmit();
          }}
        >
          {t('actions.skip')}
        </Button>
      }
    >
      <Controller
        control={form.control}
        name="interests"
        render={({ field }) => (
          <>
            <ToggleGroup
              type="multiple"
              value={field.value}
              onValueChange={field.onChange}
              aria-label={t('interests.groupLabel', { name: profile.displayName })}
            >
              {INTERESTS.map((interest) => {
                const Icon = INTEREST_ICONS[interest];
                const isLocked = field.value.length >= max && !field.value.includes(interest);
                return (
                  <ToggleGroupItem key={interest} value={interest} disabled={isLocked}>
                    <Icon className="size-5 text-secondary-copy" aria-hidden="true" />
                    {t(`interests.items.${interest}`)}
                    <Check
                      className="hidden size-4 text-primary-copy in-data-[state=on]:block"
                      aria-hidden="true"
                    />
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <p aria-live="polite" className="font-semibold text-copy-muted">
              {t('interests.counter', { count: field.value.length, max })}
              {field.value.length >= max && ` · ${t('interests.limitReached')}`}
            </p>
          </>
        )}
      />
    </StepFrame>
  );
}
