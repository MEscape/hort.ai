import type { BetterAuthInstance } from './create-auth';

/** The only two facts about a session that this module uses. */
export interface SessionSnapshot {
  readonly user: { readonly id: string; readonly email: string; readonly emailVerified: boolean };
  readonly session: { readonly createdAt: Date };
}

/**
 * Narrows what the actor provider needs from Better Auth to one function
 * that returns only those facts. Taking this instead of the whole `auth`
 * object lets tests supply a fake session source without a database, and
 * keeps provider types from spreading past the adapter files.
 */
export interface SessionSource {
  getSession(input: { headers: Headers }): Promise<SessionSnapshot | null>;
}

/**
 * Adapts Better Auth to the narrow `SessionSource`. The instance is asked for
 * at the first lookup, not when the source is built: other modules wire the
 * actor provider while they are imported, and `next build` imports them with
 * no database to check Better Auth's schema against.
 */
export function sessionSourceFrom(getInstance: () => BetterAuthInstance): SessionSource {
  return {
    async getSession(input) {
      const result = await getInstance().api.getSession(input);
      if (result === null) {
        return null;
      }
      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
        },
        session: { createdAt: result.session.createdAt },
      };
    },
  };
}
