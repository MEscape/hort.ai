'use client';

import { useId } from 'react';

import { Controller, useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { SelectField } from '@components/shared/select-field';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Switch } from '@components/ui/switch';

import { useTranslations } from '@i18n/client';

import { DAILY_LIMIT_MINUTES } from '../../application/contracts/learner-constraints';
import { NO_LIMIT } from '../schemas/onboarding-schema';

import { SettingRow } from './setting-row';
import { SettingsGroup } from './settings-group';
import { FROM_OPTIONS, UNTIL_OPTIONS } from './time-options';

import type { ControlsForm } from '../schemas/onboarding-schema';
import type { Control, FieldErrors } from 'react-hook-form';

export interface TimeSettingsProps {
  readonly control: Control<ControlsForm>;
  readonly errors: FieldErrors<ControlsForm>;
  readonly errorText: (code: string | undefined) => string | undefined;
}

/** The daily limit and the optional window of the day in which Hort is available, as one group. */
export function TimeSettings({ control, errors, errorText }: TimeSettingsProps) {
  const t = useTranslations('learner');
  const id = useId();
  const isWindowOn = useWatch({ control, name: 'windowEnabled' });
  const limitError = errorText(errors.dailyLimitMinutes?.message);

  return (
    <SettingsGroup title={t('controls.groups.time')} description={t('controls.time.description')}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor={`${id}-limit`} className="font-semibold">
            {t('controls.time.limit')}
          </Label>
          <p id={`${id}-limit-hint`} className="text-copy-muted">
            {t('controls.time.limitHint')}
          </p>
        </div>
        <Controller
          control={control}
          name="dailyLimitMinutes"
          render={({ field }) => (
            <Select name={field.name} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={`${id}-limit`}
                onBlur={field.onBlur}
                aria-invalid={limitError === undefined ? undefined : true}
                aria-describedby={`${id}-limit-hint`}
                className="sm:w-48"
              >
                <SelectValue placeholder={t('controls.time.limitNone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LIMIT}>{t('controls.time.limitNone')}</SelectItem>
                {DAILY_LIMIT_MINUTES.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {t('controls.time.limitOption', { minutes })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {limitError !== undefined && (
        <div className="px-4 py-3">
          <FieldMessage id={`${id}-limit-error`}>{limitError}</FieldMessage>
        </div>
      )}
      <Controller
        control={control}
        name="windowEnabled"
        render={({ field }) => (
          <SettingRow
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
        <div className="grid grid-cols-2 gap-4 p-4">
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
      <p className="p-4 text-sm text-copy-muted">{t('controls.time.note')}</p>
    </SettingsGroup>
  );
}
