import { Hort } from '@components/brand/hort';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { UserPlus } from '@components/ui/icons';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { authRoutes } from '../routes';

/**
 * The front door of the story (the first step of the mockups): Hort waves, one sentence says what
 * this is, and there are two clear ways in. The main one is a parent registering; the second is for
 * someone who already has an account. A Server Component.
 */
export async function WelcomePanel() {
  const t = await getTranslations('auth');

  return (
    <Card>
      <CardHeader className="pt-0">
        <Hort mood="hello" isAmbient className="-mt-20 size-36" />
        <h1 className="text-4xl">{t('welcome.title')}</h1>
        <p className="measure text-lead text-copy-muted">{t('welcome.description')}</p>
      </CardHeader>
      <CardContent>
        <Button asChild size="lg">
          <Link href={authRoutes.signUp()}>
            <UserPlus aria-hidden="true" />
            {t('welcome.signUp')}
          </Link>
        </Button>
        <div className="flex flex-col items-center gap-3">
          <p className="text-copy-muted">{t('welcome.haveAccount')}</p>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href={authRoutes.signIn()}>{t('welcome.signIn')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
