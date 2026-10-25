import 'server-only';

import { Card, CardContent, CardHeader } from '@components/ui/card';

import { getTranslations } from '@i18n/server';

import { getAuthQueries } from '../../composition';
import { ROLE_LABEL_KEYS } from '../account/role-label-keys';

import { DisplayNameForm } from './display-name-form';
import { PasswordChangeForm } from './password-change-form';
import { SignOutButton } from './sign-out-button';

/**
 * The signed-in person's account settings: name (editable), address and role (read-only), the
 * password, and signing out. Loaded through the authorized account query; nothing secret leaves it.
 */
export async function AccountSettings() {
  const t = await getTranslations('auth');
  const result = await getAuthQueries().getAccount.execute();
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  const account = result.value;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-3xl text-copy sm:text-4xl">{t('account.title')}</h1>
      <Card>
        <CardHeader className="items-start text-left">
          <h2 className="font-heading text-2xl text-copy">{t('account.profileTitle')}</h2>
        </CardHeader>
        <CardContent>
          <DisplayNameForm currentName={account.name} />
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold text-copy-muted">{t('account.email')}</dt>
            <dd className="break-all text-copy">{account.email}</dd>
            <dt className="font-semibold text-copy-muted">{t('account.role')}</dt>
            <dd className="text-copy">{t(ROLE_LABEL_KEYS[account.role])}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="items-start text-left">
          <h2 className="font-heading text-2xl text-copy">{t('account.passwordTitle')}</h2>
          <p className="text-copy-muted">{t('account.passwordHint')}</p>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="items-start">
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
