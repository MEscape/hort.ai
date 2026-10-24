/**
 * Server-side public API of the learner module. Other modules and framework
 * entry points import from here and nowhere deeper. Components that run in
 * the browser import from `./client` instead: this file reaches server-only
 * code through `composition.ts` and must never end up in a client bundle.
 */

/** Server-only queries for Server Components. Mutations are reachable through Server Actions only. */
export { learnerQueries } from './composition';

export { learnerRoutes } from './presentation/routes';

export { default as enLearner } from './presentation/i18n/en.json';
export { default as deLearner } from './presentation/i18n/de.json';

export type { ChildProfileView } from './application/contracts/learner-views';
