import { buildQueryString } from '@lib/utils';

/** App-shell entry to a child's homework help; the locale-aware Link adds the locale. */
export const guidanceRoutes = {
  start: (childProfileId: string) => `/start${buildQueryString({ child: childProfileId })}`,
} as const;
