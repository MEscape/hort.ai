import { isDefined } from '@lib/utils';

import { DEFAULT_RETURN_PATH } from '../routes';

/** Longest `returnTo` a request may carry; also enforced by the action schema. */
export const RETURN_PATH_MAX_LENGTH = 2048;

/**
 * Any origin that cannot be a real one. A path that resolves against it to
 * a DIFFERENT origin was not a plain path (`//evil.example`, `/\evil.example`,
 * `/\t/evil.example`: the URL parser normalises all of those).
 */
const PLACEHOLDER_ORIGIN = 'https://return-path.invalid';

/**
 * Turns an untrusted `returnTo` into a same-site path or the default. This
 * is the open-redirect guard: the result is always a path on this site,
 * and the fragment is dropped.
 */
export function resolveReturnPath(raw: string | undefined): string {
  if (!isDefined(raw) || !raw.startsWith('/')) {
    return DEFAULT_RETURN_PATH;
  }
  if (raw.length > RETURN_PATH_MAX_LENGTH) {
    return DEFAULT_RETURN_PATH;
  }

  const resolved = new URL(raw, PLACEHOLDER_ORIGIN);
  if (resolved.origin !== PLACEHOLDER_ORIGIN) {
    return DEFAULT_RETURN_PATH;
  }

  return `${resolved.pathname}${resolved.search}`;
}
