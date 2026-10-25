import type { AccountApi } from './better-auth-account-manager';
import type { BetterAuthInstance } from './create-auth';

/**
 * Adapts Better Auth to the narrow `AccountApi`. `updateUser` is called in-process with the name
 * alone; its HTTP route stays disabled because the provider would accept the role there. The
 * instance is asked for at the first call, as in `sessionSourceFrom`: building the use cases must
 * not need a configured provider (development without authentication, `next build`).
 */
export function accountApiFrom(getInstance: () => BetterAuthInstance): AccountApi {
  return {
    getSession: async ({ headers }) => getInstance().api.getSession({ headers }),
    updateUser: async ({ body, headers }) => getInstance().api.updateUser({ body, headers }),
    changePassword: async ({ body, headers }) =>
      getInstance().api.changePassword({ body, headers }),
  };
}
