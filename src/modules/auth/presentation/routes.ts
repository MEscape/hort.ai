import { buildQueryString } from '@lib/utils';

/**
 * Where a successful sign-in lands when no safe `returnTo` was given: the parent's home. The page
 * itself belongs to the app shell (`src/app/[locale]/(app)/home`).
 */
export const DEFAULT_RETURN_PATH = '/home';

/** Revalidating the root layout refreshes everything that depends on who is signed in. */
export const ROOT_LAYOUT_PATH = '/';

/**
 * Routes of the module, in one place so actions, components and the composition root (which
 * tells the provider where emailed links lead) cannot drift apart. Paths carry no locale
 * prefix: the locale-aware `Link` and `redirect` add it.
 */
export const authRoutes = {
  /** The front door: a welcome with the two ways in. */
  welcome: () => '/welcome',
  signIn: (returnTo?: string) => `/sign-in${buildQueryString({ returnTo })}`,
  /** Open registration: a parent creates an account here. */
  signUp: () => '/sign-up',
  forgotPassword: () => '/forgot-password',
  /** Landing page of the emailed reset link; Better Auth appends `?token=`. */
  resetPassword: () => '/reset-password',
  /** Landing page after the emailed verification link; Better Auth appends `?error=` on failure. */
  emailVerified: () => '/email-verified',
  /** Where a signed-in person goes home: the role-aware start page. */
  home: () => DEFAULT_RETURN_PATH,
  /** The signed-in person's own account: name, address, role, password. */
  settings: () => '/settings',
} as const;
