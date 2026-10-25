import { Suspense } from 'react';

import { redirect, requireLocale } from '@i18n';

import { APP_IDENTITY } from '@lib/config';
import { buildPrivateMetadata } from '@lib/seo';

export const metadata = buildPrivateMetadata(APP_IDENTITY.name);

interface TaskPageProps {
  readonly params: Promise<{ locale: string }>;
}

/** The old placeholder entry: old links land on the help screen, which asks for the task. */
async function ToStart({ params }: TaskPageProps): Promise<never> {
  const locale = requireLocale((await params).locale);
  return redirect({ href: '/help', locale });
}

export default function TaskPage(props: TaskPageProps) {
  return (
    <Suspense>
      <ToStart {...props} />
    </Suspense>
  );
}
