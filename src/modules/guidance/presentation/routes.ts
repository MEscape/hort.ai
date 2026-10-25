import { buildQueryString } from '@lib/utils';

/**
 * The child's homework help: one canvas screen. `help()` shows the open task, or asks for one when
 * none is open; `newTask()` asks for a new task even while one is open. The locale-aware Link adds
 * the locale.
 */
export const guidanceRoutes = {
  help: () => '/help',
  newTask: () => `/help${buildQueryString({ new: '1' })}`,
} as const;
