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
 */
export const LEARNER_PERMISSIONS = [
  'learner.create',
  'learner.read',
  'learner.update',
  'learner.delete',
] as const;

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

export const PERMISSIONS = [...LEARNER_PERMISSIONS, ...TEACHER_PERMISSIONS] as const;

export type Permission = (typeof PERMISSIONS)[number];
