import { validationError } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  MATERIAL_MAX_BYTES,
  MATERIAL_POWERPOINT_CONTENT_TYPE,
  MATERIAL_WORD_CONTENT_TYPE,
} from '../../domain/models/material';
import { MATERIAL_QUERY_LIMITS } from '../material-limits';

import type { ConvertibleMaterialMime } from '../../domain/models/material';
import type { BeginMaterialInput } from '../contracts/material-inputs';

export function invalidMaterial(): ValidationAppError {
  return validationError('teacher_material.validation_failed', 'Invalid material.', {
    file: ['teacher_material.validation.invalid_file'],
  });
}
export function isConvertibleContentType(value: string): value is ConvertibleMaterialMime {
  return value === MATERIAL_WORD_CONTENT_TYPE || value === MATERIAL_POWERPOINT_CONTENT_TYPE;
}
/** No PDF parser is installed. Fail closed rather than claiming PDF extraction succeeded. */
export function validateMaterialInput(
  input: BeginMaterialInput,
): AppResult<BeginMaterialInput, ValidationAppError> {
  return input.contentType === 'text/plain' &&
    Number.isInteger(input.sizeBytes) &&
    input.sizeBytes > 0 &&
    input.sizeBytes <= MATERIAL_MAX_BYTES &&
    input.title.trim().length > 0 &&
    input.title.length <= MATERIAL_QUERY_LIMITS.title
    ? ok(input)
    : err(invalidMaterial());
}
/** UTF-8 text has no magic number: reject binary controls, PDF and common active-content signatures. */
export function decodeMaterial(
  bytes: Uint8Array,
  options: { readonly prefix?: boolean } = {},
): AppResult<string, ValidationAppError> {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes, {
      stream: options.prefix === true,
    });
  } catch {
    return err(invalidMaterial());
  }

  if (
    // eslint-disable-next-line no-control-regex -- Binary magic is rejected, not interpreted as text.
    /[^\S\r\n]*^(?:%PDF-|PK\u0003\u0004|MZ|\x7fELF|GIF8|\x89PNG)/m.test(text) ||
    // eslint-disable-next-line no-control-regex -- Only text whitespace controls are accepted.
    /[\x00-\x08\x0b\x0e-\x1f]/.test(text)
  ) {
    return err(invalidMaterial());
  }
  return ok(text);
}
