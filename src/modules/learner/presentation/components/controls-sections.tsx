'use client';

import { useId } from 'react';

import { Controller } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { Checkbox } from '@components/ui/checkbox';
import { Check } from '@components/ui/icons';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';

import { useTranslations } from '@i18n/client';

import { GUARDIAN_CONSENT_VERSION } from '../../application/contracts/learner-constraints';

import { SettingRow } from './setting-row';
import { SettingsGroup } from './settings-group';

import type { ControlsForm } from '../schemas/onboarding-schema';
import type { Control, FieldErrors } from 'react-hook-form';

export interface ControlsSectionProps {
  readonly control: Control<ControlsForm>;
  readonly errors: FieldErrors<ControlsForm>;
  readonly errorText: (code: string | undefined) => string | undefined;
  readonly name: string;
}

/** Whether the child may speak to the chosen companion and hear it speak. Off until the parent says otherwise. */
export function VoiceSetting({
  control,
  name,
  tutorName,
}: Pick<ControlsSectionProps, 'control' | 'name'> & { readonly tutorName: string }) {
  const t = useTranslations('learner');
  const id = useId();

  return (
    <SettingsGroup title={t('controls.groups.voice')}>
      <Controller
        control={control}
        name="voiceEnabled"
        render={({ field }) => (
          <SettingRow
            titleId={`${id}-title`}
            descriptionId={`${id}-description`}
            title={t('controls.voice.title', { tutor: tutorName })}
            description={t('controls.voice.description', { name, tutor: tutorName })}
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
    </SettingsGroup>
  );
}

/** Whether Hort may note what kinds of tasks needed help, for the parent's later summary. */
export function InsightsSetting({ control, name }: Pick<ControlsSectionProps, 'control' | 'name'>) {
  const t = useTranslations('learner');
  const id = useId();

  return (
    <SettingsGroup title={t('controls.groups.notes')}>
      <Controller
        control={control}
        name="learningInsights"
        render={({ field }) => (
          <SettingRow
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
    </SettingsGroup>
  );
}

/** What Hort does whatever the parent chooses: said plainly, with no switch to pretend otherwise. */
export function AlwaysOnNote() {
  const t = useTranslations('learner');
  const id = useId();

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="font-heading text-xl font-semibold text-copy">
        {t('controls.always.title')}
      </h2>
      <ul className="flex flex-col gap-2 rounded-token-lg bg-sunken p-4">
        {(['solution', 'checks', 'private'] as const).map((key) => (
          <li key={key} className="flex items-start gap-3 text-copy">
            <Check
              className="mt-1 size-4 shrink-0 text-copy-muted"
              strokeWidth={3}
              aria-hidden="true"
            />
            {t(`controls.always.items.${key}`)}
          </li>
        ))}
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
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="font-heading text-xl font-semibold text-copy">
        {t('controls.groups.guardian')}
      </h2>
      <div className="flex flex-col gap-2 rounded-token-lg border-2 border-border-strong bg-surface p-4">
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
    </section>
  );
}
