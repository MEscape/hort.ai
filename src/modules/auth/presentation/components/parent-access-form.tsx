'use client';

import { PasswordField } from '@components/shared/password-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { CREDENTIAL_LIMITS } from '../../application/contracts/auth-constraints';
import { useParentAccessForm } from '../hooks/use-parent-access-form';

/** This route renders no parent controls or child profile data before server-side reauthentication. */
export function ParentAccessForm() {
  const t = useTranslations('auth');
  const form = useParentAccessForm();
  return (
    <form onSubmit={form.onSubmit} className="flex flex-col gap-4">
      <p>{t('parentAccess.intro')}</p>
      <PasswordField
        id="parent-password"
        label={t('signIn.password')}
        autoComplete="current-password"
        maxLength={CREDENTIAL_LIMITS.passwordMax}
        required
        value={form.password}
        onChange={(event) => {
          form.setPassword(event.currentTarget.value);
        }}
        error={form.error}
      />
      <Button type="submit" disabled={form.isPending}>
        {t(form.isPending ? 'signIn.submitting' : 'parentAccess.open')}
      </Button>
    </form>
  );
}
