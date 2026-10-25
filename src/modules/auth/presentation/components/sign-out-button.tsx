'use client';

import { useId } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { Button } from '@components/ui/button';
import { LogOut } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useSignOut } from '../hooks/use-sign-out';

/**
 * Ends the visit. A failed sign-out stays on the page and says so, so it can be tried again and
 * never looks like a success.
 */
export function SignOutButton() {
  const t = useTranslations('auth');
  const id = useId();
  const { isPending, error, signOut } = useSignOut();

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        aria-busy={isPending}
        onClick={signOut}
      >
        <LogOut aria-hidden="true" />
        {isPending ? t('signOut.pending') : t('signOut.label')}
      </Button>
      <FormAlert id={`${id}-error`} message={error} />
    </div>
  );
}
