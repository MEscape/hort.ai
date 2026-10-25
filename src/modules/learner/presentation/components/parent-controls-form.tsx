'use client';

import { useId } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useParentControls } from '../hooks/use-parent-controls';

import { InsightsSetting } from './controls-sections';
import { TimeSettings } from './time-settings';

import type { ChildProfileDto } from '../dto/learner-dto';

/** Pending first; after a failed save the button offers the retry. */
const submitLabel = ({
  isPending,
  formError,
}: {
  readonly isPending: boolean;
  readonly formError: unknown;
}) => {
  if (isPending) {
    return 'saving';
  }
  return formError === undefined ? 'save' : 'retry';
};

/** The same controls and validation as setup, with child choices and voice consent excluded. */
export function ParentControlsForm({ profile }: { readonly profile: ChildProfileDto }) {
  const t = useTranslations('learner.dashboard');
  const state = useParentControls(profile);
  const id = useId();
  return (
    <form onSubmit={state.onSubmit} className="flex flex-col gap-6" aria-busy={state.isPending}>
      <fieldset disabled={state.isPending} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">{t('settingsTitle')}</legend>
        <TimeSettings
          control={state.form.control}
          errors={state.form.formState.errors}
          errorText={state.errorText}
        />
        <p className="text-sm text-copy-muted">{t('timeEnforcement')}</p>
        <InsightsSetting control={state.form.control} name={profile.displayName} />
        <p className="text-sm text-copy-muted">{t('insightsEffect')}</p>
      </fieldset>
      <FormAlert
        id={`${id}-error`}
        message={state.formError === undefined ? undefined : t('saveError')}
      />
      {state.saved && (
        <p role="status" className="font-semibold text-success">
          {t('saved')}
        </p>
      )}
      <div>
        <Button type="submit" disabled={state.isPending}>
          {t(submitLabel(state))}
        </Button>
      </div>
    </form>
  );
}
