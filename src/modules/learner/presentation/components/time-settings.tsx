'use client';

import { useId } from 'react';

import { Controller, useWatch } from 'react-hook-form';

import { SelectField } from '@components/shared/select-field';
import { Clock } from '@components/ui/icons';
import { Switch } from '@components/ui/switch';

import { useTranslations } from '@i18n/client';

import { DAILY_LIMIT_MINUTES } from '../../application/contracts/learner-constraints';
import { NO_LIMIT } from '../schemas/onboarding-schema';

import { SettingRow } from './setting-row';
import { FROM_OPTIONS, UNTIL_OPTIONS } from './time-options';

import type { ControlsForm } from '../schemas/onboarding-schema';
import type { Control, FieldErrors } from 'react-hook-form';

export interface TimeSettingsProps {
  readonly control: Control<ControlsForm>;
  readonly errors: FieldErrors<ControlsForm>;
  readonly errorText: (code: string | undefined) => string | undefined;
}

/** The daily limit and the optional window of the day in which Hort is available. */
export function TimeSettings({ control, errors, errorText }: TimeSettingsProps) {
  const t = useTranslations('learner');
  const id = useId();
  const isWindowOn = useWatch({ control, name: 'windowEnabled' });

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="font-heading text-lg font-semibold">
          {t('controls.time.title')}
        </h2>
        <p className="text-copy-muted">{t('controls.time.description')}</p>
      </div>
      <Controller
        control={control}
        name="dailyLimitMinutes"
        render={({ field }) => (
          <SelectField
            id={`${id}-limit`}
            name={field.name}
            label={t('controls.time.limit')}
            placeholder={t('controls.time.limitNone')}
            options={[
              { value: NO_LIMIT, label: t('controls.time.limitNone') },
              ...DAILY_LIMIT_MINUTES.map((minutes) => ({
                value: String(minutes),
                label: t('controls.time.limitOption', { minutes }),
              })),
            ]}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            error={errorText(errors.dailyLimitMinutes?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="windowEnabled"
        render={({ field }) => (
          <SettingRow
            icon={Clock}
            tone="amber"
            titleId={`${id}-window-title`}
            descriptionId={`${id}-window-description`}
            title={t('controls.time.windowTitle')}
            description={t('controls.time.windowDescription')}
            stateText={field.value ? t('controls.time.windowOn') : t('controls.time.windowOff')}
          >
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-labelledby={`${id}-window-title`}
              aria-describedby={`${id}-window-description`}
            />
          </SettingRow>
        )}
      />
      {isWindowOn && (
        <div className="grid grid-cols-2 gap-4">
          <Controller
            control={control}
            name="windowFrom"
            render={({ field }) => (
              <SelectField
                id={`${id}-from`}
                name={field.name}
                label={t('controls.time.from')}
                placeholder={t('controls.time.from')}
                options={FROM_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="windowUntil"
            render={({ field }) => (
              <SelectField
                id={`${id}-until`}
                name={field.name}
                label={t('controls.time.until')}
                placeholder={t('controls.time.until')}
                options={UNTIL_OPTIONS}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                error={errorText(errors.windowUntil?.message)}
              />
            )}
          />
        </div>
      )}
      <p className="text-sm text-copy-muted">{t('controls.time.note')}</p>
    </section>
  );
}
