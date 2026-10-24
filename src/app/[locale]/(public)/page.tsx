import { authRoutes } from '@modules/auth';

import { redirect, requireLocale } from '@i18n';

import { APP_IDENTITY } from '@lib/config';
import { buildPrivateMetadata } from '@lib/seo';

export const metadata = buildPrivateMetadata(APP_IDENTITY.name);

export default async function IndexPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  redirect({ href: authRoutes.welcome(), locale: requireLocale((await params).locale) });
}
