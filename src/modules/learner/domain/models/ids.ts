import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { LEARNER_VALIDATION_CODES, fieldValidationFailed } from '../errors/learner-errors';

/** Opaque identity of a child profile. */
export type ChildProfileId = Brand<string, 'ChildProfileId'>;

/** A tutor of the tutors module's catalog, by its stable id. */
export type TutorId = Brand<string, 'TutorId'>;

/** One help session of the child, as the parent view addresses it. */
export type ParentTaskId = Brand<string, 'ParentTaskId'>;

/** The parent who owns a profile. Same brand as the auth module's own, so values cross without mapping. */
export type ActorId = Brand<string, 'ActorId'>;

/** The tenant a profile belongs to. Same brand as the rest of the app's tenant id. */
export type TenantId = Brand<string, 'TenantId'>;

const ID_MAX_LENGTH = 128;

const isValidId = (raw: string) => raw.length > 0 && raw.length <= ID_MAX_LENGTH;

/** Brands an id read from storage or handed over by a module that already checked it. */
export function toChildProfileId(raw: string): ChildProfileId {
  return raw as ChildProfileId; // Brand constructor: the cast is only permitted here.
}

/** Brands a tutor id read from storage or handed over by a module that already checked it. */
export function toTutorId(raw: string): TutorId {
  return raw as TutorId; // Brand constructor: the cast is only permitted here.
}

/** Brands a help-session id read from storage. */
export function toParentTaskId(raw: string): ParentTaskId {
  return raw as ParentTaskId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id read from storage or handed over by a module that already checked it. */
export function toActorId(raw: string): ActorId {
  return raw as ActorId; // Brand constructor: the cast is only permitted here.
}

/** Brands a tenant id read from storage or handed over by a module that already checked it. */
export function toTenantId(raw: string): TenantId {
  return raw as TenantId; // Brand constructor: the cast is only permitted here.
}

/** Brands a profile id that arrived from a request, after checking its shape. */
export const parseChildProfileId = createIdParser({
  isValid: isValidId,
  brand: toChildProfileId,
  mapError: () => fieldValidationFailed('profileId', LEARNER_VALIDATION_CODES.idInvalid),
});

/** Brands a task id from the parent task URL, after checking its shape. */
export const parseParentTaskId = createIdParser({
  isValid: isValidId,
  brand: toParentTaskId,
  mapError: () => fieldValidationFailed('taskId', LEARNER_VALIDATION_CODES.idInvalid),
});

/** @keep Every branded id has a request parser (brand rule); no request names an owner or tenant today. */
export const parseActorId = createIdParser({
  isValid: isValidId,
  brand: toActorId,
  mapError: () => fieldValidationFailed('ownerId', LEARNER_VALIDATION_CODES.idInvalid),
});

/** @keep Every branded id has a request parser (brand rule); no request names an owner or tenant today. */
export const parseTenantId = createIdParser({
  isValid: isValidId,
  brand: toTenantId,
  mapError: () => fieldValidationFailed('tenantId', LEARNER_VALIDATION_CODES.idInvalid),
});

/** Brands a tutor id that arrived from a request, after checking its shape. Whether the catalog offers it is asked separately. */
export const parseTutorId = createIdParser({
  isValid: isValidId,
  brand: toTutorId,
  mapError: () => fieldValidationFailed('tutorId', LEARNER_VALIDATION_CODES.tutorInvalid),
});
