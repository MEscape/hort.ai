/**
 * Routes of the module. Paths carry no locale prefix: the locale-aware `Link` and `redirect` add it.
 * The page itself belongs to the app shell (`src/app/[locale]/(app)/onboarding`).
 */
export const learnerRoutes = {
  parent: (section = 'overview', range = 'week') => `/parent?section=${section}&range=${range}`,
  parentTask: (id: string) => `/parent/tasks/${encodeURIComponent(id)}`,
  onboarding: () => '/onboarding',
  /** The child's own one-time welcome, after the parent finished the setup. */
  welcome: () => '/hello',
  /** Where a finished (or already finished) setup leads: the parent's home. */
  home: () => '/home',
} as const;

/** Revalidating the root layout refreshes every page that shows the child's saved controls. */
export const ROOT_LAYOUT_PATH = '/';
