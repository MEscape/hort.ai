import { Suspense } from 'react';

import { redirect, requireLocale } from '@i18n';

import { APP_IDENTITY } from '@lib/config';
import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

export const metadata = buildPrivateMetadata(APP_IDENTITY.name);

interface StartPageProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

/**
 * There is no separate start page any more: homework help is one canvas screen (`/help`), which
 * asks for the task when none is open. Old links still work: an island's `?area=&place=` is kept
 * and asks for a new task right away; the help page validates it.
 */
async function ToHelp({ params, searchParams }: StartPageProps): Promise<never> {
  const locale = requireLocale((await params).locale);
  const query = await searchParams;
  const area = single(query['area']);
  return redirect({
    href: `/help${buildQueryString(
      area === undefined ? {} : { new: '1', area, place: single(query['place']) },
    )}`,
    locale,
  });
}

export default function StartPage(props: StartPageProps) {
  return (
    <Suspense>
      <ToHelp {...props} />
    </Suspense>
  );
}
