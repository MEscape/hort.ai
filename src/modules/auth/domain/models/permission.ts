/**
 * Permissions are capabilities: "<resource>.<action>". They name what may
 * be done, never a route or a component.
 *
 * The union is closed on purpose. Adding a permission here is the only way
 * to introduce one, and every exhaustive check downstream (the role table,
 * tests) fails to compile until it is handled.
 *
 * `learner.*` is the child profile's: a parent manages the learners they are the guardian of.
 * The profile itself belongs to the learner module; authentication only decides who may touch it.
 *
 * `progression.*` is a child's progress (XP, level, the daily reward). It is held by the child's
 * parent, on the parent's own children only, like `learner.*`.
 */
export const PERMISSIONS = [
  'learner.create',
  'learner.read',
  'learner.update',
  'learner.delete',
  'progression.read',
  'progression.update',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
