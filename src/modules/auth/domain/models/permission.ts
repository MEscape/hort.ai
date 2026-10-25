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
 * `classroom.*`, `material.*` and `assignment.*` are a teacher's, on their own classes (#8, #32,
 * #29, #33).
 * `hint.request` lets a parent ask the AI companion for a hint for one of their own child profiles
 * (#10); the guidance module checks the profile's ownership itself.
 *
 * `voice.use` lets the tutors speak and turns the child's speech into text (paid provider calls).
 * The child speaks within the guardian's session, so it is the parent's permission.
 *
 * `progression.*` is a child's progress (XP, level, the daily reward). It is held by the child's
 * parent, on the parent's own children only, like `learner.*`. `progression.daily_reward` is only the
 * once-a-day snack, apart from `progression.update` (learning XP), so a child channel can be given the
 * one without the other. `learner.list` reads the guardian's whole set of profiles (the onboarding
 * state), apart from `learner.read` on one profile.
 */
export const LEARNER_PERMISSIONS = [
  'learner.create',
  'learner.read',
  'learner.update',
  'learner.delete',
  'learner.list',
  'progression.read',
  'progression.update',
  'progression.daily_reward',
  'voice.use',
] as const;

export const GUIDANCE_PERMISSIONS = ['hint.request'] as const;

/**
 * The signed-in person's own account (name, password): every role has it, and it only ever reaches
 * the account of the session itself, never another one.
 */
export const ACCOUNT_PERMISSIONS = ['account.read', 'account.update'] as const;

export const TEACHER_PERMISSIONS = [
  'classroom.create',
  'classroom.read',
  'classroom.update',
  'classroom.archive',
  'material.create',
  'material.read',
  'material.delete',
  'assignment.create',
  'assignment.read',
  'assignment.update',
  'assignment.delete',
] as const;

export const PERMISSIONS = [
  ...LEARNER_PERMISSIONS,
  ...GUIDANCE_PERMISSIONS,
  ...TEACHER_PERMISSIONS,
  ...ACCOUNT_PERMISSIONS,
] as const;

export type Permission = (typeof PERMISSIONS)[number];
