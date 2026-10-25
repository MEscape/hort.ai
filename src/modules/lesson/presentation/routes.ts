/**
 * Routes of the module. Paths carry no locale prefix: the locale-aware `Link` and `redirect` add it.
 * The page belongs to the app shell (`src/app/[locale]/(app)/learn`).
 */
export const lessonRoutes = {
  /** The canvas lesson (one lesson in the vertical slice). */
  play: () => '/learn',
} as const;
