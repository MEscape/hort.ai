/**
 * Routes of the module. Paths carry no locale prefix: the locale-aware `Link` and `redirect` add it.
 * The pages belong to the app shell (`src/app/[locale]/(app)/world`).
 */
export const worldRoutes = {
  /** Every island of the world. */
  map: () => '/world',
  /** One island and the places on it. */
  island: (areaId: string) => `/world/${encodeURIComponent(areaId)}`,
} as const;
