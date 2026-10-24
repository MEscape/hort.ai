import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { slugify } from '@lib/utils';

import { tenantInvalid } from '../errors/auth-errors';

import { toTenantId } from './ids';

import type { TenantId } from './ids';

/** The same bound `AUTH_DEFAULT_TENANT_ID` is validated with at startup (`@lib/config`). */
const TENANT_ID_MAX_LENGTH = 64;

/**
 * Validates the configured tenant id: a slug (lower-case letters, digits, single hyphens), so it
 * is safe in keys and logs. The tenant is deployment configuration, never a request value: the
 * composition root is the only caller, and no tenant is chosen from a header, cookie or form field.
 */
export function createTenantId(raw: string): AppResult<TenantId, ValidationAppError> {
  const isValid = raw.length > 0 && raw.length <= TENANT_ID_MAX_LENGTH && slugify(raw) === raw;
  return isValid ? ok(toTenantId(raw)) : err(tenantInvalid());
}
