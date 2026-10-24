/**
 * Hard ceiling on a session's age, measured from sign-in. The provider's
 * own expiry slides forward on activity and has no ceiling, so without
 * this rule a stolen session that is kept busy never dies. It is a
 * business rule, so it lives here and not in the provider adapter; the
 * clock is passed in because the domain never reads it.
 */
export function hasExceededMaxLifetime(createdAt: Date, now: Date, maxLifetimeMs: number): boolean {
  return now.getTime() - createdAt.getTime() >= maxLifetimeMs;
}
