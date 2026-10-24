'use client';

import { useId } from 'react';

import { Controller } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { Checkbox } from '@components/ui/checkbox';
import { BookOpen, Mic, ShieldCheck } from '@components/ui/icons';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';

import { useTranslations } from '@i18n/client';

import { GUARDIAN_CONSENT_VERSION } from '../../application/contracts/learner-constraints';

import { SettingRow } from './setting-row';

import type { ControlsForm } from '../schemas/onboarding-schema';
import type { Control, FieldErrors } from 'react-hook-form';

export interface ControlsSectionProps {
  readonly control: Control<ControlsForm>;
  readonly errors: FieldErrors<ControlsForm>;
  readonly errorText: (code: string | undefined) => string | undefined;
  readonly name: string;
}

/** Whether the child may speak to Hort and hear it speak. Off until the parent says otherwise. */
export function VoiceSetting({ control, name }: Pick<ControlsSectionProps, 'control' | 'name'>) {
  const t = useTranslations('learner');
  const id = useId();

  return (
    <Controller
      control={control}
      name="voiceEnabled"
      render={({ field }) => (
        <SettingRow
          icon={Mic}
          tone="sky"
          titleId={`${id}-title`}
          descriptionId={`${id}-description`}
          title={t('controls.voice.title')}
          description={t('controls.voice.description', { name })}
          stateText={field.value ? t('controls.voice.on') : t('controls.voice.off')}
        >
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
          />
        </SettingRow>
      )}
    />
  );
}

/** Whether Hort may note what kinds of tasks needed help, for the parent's later summary. */
export function InsightsSetting({ control, name }: Pick<ControlsSectionProps, 'control' | 'name'>) {
  const t = useTranslations('learner');
  const id = useId();

  return (
    <Controller
      control={control}
      name="learningInsights"
      render={({ field }) => (
        <SettingRow
          icon={BookOpen}
          tone="bloom"
          titleId={`${id}-title`}
          descriptionId={`${id}-description`}
          title={t('controls.insights.title')}
          description={t('controls.insights.description', { name })}
          stateText={field.value ? t('controls.insights.on') : t('controls.insights.off')}
        >
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
          />
        </SettingRow>
      )}
    />
  );
}

/** What Hort does whatever the parent chooses: said plainly, with no switch to pretend otherwise. */
export function AlwaysOnNote() {
  const t = useTranslations('learner');
  const id = useId();

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-3 rounded-token-lg bg-success-subtle p-4"
    >
      <h2
        id={`${id}-heading`}
        className="flex items-center gap-2 font-heading text-lg font-semibold text-success"
      >
        <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
        {t('controls.always.title')}
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-6 text-copy marker:text-success">
        <li>{t('controls.always.items.solution')}</li>
        <li>{t('controls.always.items.checks')}</li>
        <li>{t('controls.always.items.private')}</li>
      </ul>
    </section>
  );
}

/** The guardian's confirmation: required, unticked at first, and refused by the server without it. */
export function GuardianConfirmation({ control, errors, errorText, name }: ControlsSectionProps) {
  const t = useTranslations('learner');
  const id = useId();
  const error = errorText(errors.guardianConfirmed?.message);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Controller
          control={control}
          name="guardianConfirmed"
          render={({ field }) => (
            <Checkbox
              id={`${id}-guardian`}
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked === true);
              }}
              aria-invalid={error === undefined ? undefined : true}
              aria-describedby={`${id}-hint${error === undefined ? '' : ` ${id}-error`}`}
              className="mt-0.5"
            />
          )}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-guardian`} className="items-start text-base font-semibold">
            {t('controls.guardian.label', { name })}
          </Label>
          <FieldMessage id={`${id}-hint`} tone="hint">
            {t('controls.guardian.hint', { version: GUARDIAN_CONSENT_VERSION })}
          </FieldMessage>
        </div>
      </div>
      <FieldMessage id={`${id}-error`}>{error}</FieldMessage>
    </div>
  );
}
