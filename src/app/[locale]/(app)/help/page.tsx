import { Suspense } from 'react';

import { AuthShell } from '@modules/auth';
import { loadOpenHelpSession } from '@modules/guidance';
import { HelpConversation } from '@modules/guidance/client';
import { requireOnboarded } from '@modules/learner';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';

import { Link, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'guidance' });
  return buildPrivateMetadata(t('conversation.taskTitle'));
}

async function HelpContent() {
  const child = await requireOnboarded();
  const tutors = buildTutorOptions();
  preloadTutorPictures(tutors, child.tutorId);
  const companion = tutors.find((option) => option.id === child.tutorId);
  const session = await loadOpenHelpSession(child.id);
  const t = await getTranslations('guidance');
  if (session === null || companion === undefined) {
    return (
      <Card>
        <CardContent className="items-center gap-5 py-10 text-center">
          <h1 className="font-heading text-3xl">{t('conversation.emptyTitle')}</h1>
          <p>{t('conversation.emptyBody')}</p>
          <Button asChild size="lg">
            <Link href={`/start${buildQueryString({ child: child.id })}`}>
              {t('conversation.newTask')}
            </Link>
          </Button>
          <Link className="underline" href="/home">
            {t('conversation.home')}
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <HelpConversation
      childProfileId={child.id}
      initial={session}
      companion={companion}
      voiceConsent={child.voiceConsent}
    />
  );
}

export default async function HelpPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['guidance', 'voice']}>
      <AuthShell>
        <Suspense fallback={null}>
          <HelpContent />
        </Suspense>
      </AuthShell>
    </I18nProvider>
  );
}
