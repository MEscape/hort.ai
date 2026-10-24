/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart.
 */
export const learnerRoutes = {
  list: () => '/learner',
  detail: (id: string) => `/learner/${id}`,
} as const;
