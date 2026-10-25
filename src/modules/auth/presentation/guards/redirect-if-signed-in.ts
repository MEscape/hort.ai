import 'server-only';

import { redirect } from '@i18n';

import { getLocale } from '@i18n/server';

import { getAuthQueries } from '../../composition';
import { DEFAULT_RETURN_PATH } from '../routes';

/**
 * Page-level guard for the front door (`/` and the welcome): a visitor who is already signed in,
 * for example after opening the installed app, goes straight to the home instead of being asked to
 * register or sign in again. Navigation convenience only, like `requireSignedIn`.
 *
 * "Not signed in" shows the page; an infrastructure failure is unexpected and reaches `error.tsx`.
 */
export async function redirectIfSignedIn(): Promise<void> {
  const result = await getAuthQueries().getCurrentActor.execute();

  if (result.isOk()) {
    redirect({ href: DEFAULT_RETURN_PATH, locale: await getLocale() });
  }
  if (result.isErr() && result.error.kind !== 'unauthorized') {
    throw new Error(result.error.code, { cause: result.error });
  }
}
