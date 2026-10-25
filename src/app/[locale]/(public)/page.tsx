import { Suspense } from 'react';

import { authRoutes, redirectIfSignedIn } from '@modules/auth';

import { redirect, requireLocale } from '@i18n';

import { APP_IDENTITY } from '@lib/config';
import { buildPrivateMetadata } from '@lib/seo';

export const metadata = buildPrivateMetadata(APP_IDENTITY.name);

interface IndexPageProps {
  readonly params: Promise<{ locale: string }>;
}

/** The installed app opens here: a signed-in visitor goes home, everyone else to the welcome. */
async function FrontDoor({ params }: IndexPageProps): Promise<never> {
  const locale = requireLocale((await params).locale);
  await redirectIfSignedIn();
  return redirect({ href: authRoutes.welcome(), locale });
}

export default function IndexPage(props: IndexPageProps) {
  return (
    <Suspense>
      <FrontDoor {...props} />
    </Suspense>
  );
}
