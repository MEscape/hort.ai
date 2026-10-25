/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart.
 */
export const classroomRoutes = {
  list: () => '/classroom',
  detail: (id: string) => `/classroom/${id}`,
} as const;
