import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { invariant, isString, oneOf } from '@lib/utils';

import { AI_OUTPUT_VALIDATION_CODES, aiOutputRejected } from '../errors/ai-output-errors';
import { HINT_LEVELS } from '../models/hint-level';

import {
  AI_OUTPUT_CONTRACT_VERSION,
  AI_OUTPUT_FIELDS,
  AI_OUTPUT_KINDS,
  ASSESSMENT_RESULTS,
  COMPETENCY_ID_PATTERN,
} from './ai-output';
import { checkAiText } from './ai-text-rules';

import type { AiOutput, AiOutputBase, AiOutputKind, AiOutputRequest } from './ai-output';
import type { AiOutputValidationCode } from '../errors/ai-output-errors';
import type { HintLevel } from '../models/hint-level';

/** The key a violation of the output as a whole is reported under. */
const WHOLE_OUTPUT = '$';

const isKind = oneOf(AI_OUTPUT_KINDS);
const isAssessmentResult = oneOf(ASSESSMENT_RESULTS);
const isHintLevel = oneOf(HINT_LEVELS);

type Codes = AiOutputValidationCode[];

/** An object whose kind is known; every other member is still unchecked. */
interface RawAiOutput {
  readonly [field: string]: unknown;
  readonly kind: AiOutputKind;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hintLevelCodes(value: unknown, expected: HintLevel): Codes {
  if (value === undefined) {
    return [AI_OUTPUT_VALIDATION_CODES.missingField];
  }
  if (!isHintLevel(value)) {
    return [AI_OUTPUT_VALIDATION_CODES.invalidHintLevel];
  }
  return value === expected ? [] : [AI_OUTPUT_VALIDATION_CODES.unexpectedHintLevel];
}

function competencyIdCodes(value: unknown): Codes {
  if (value === undefined || (isString(value) && COMPETENCY_ID_PATTERN.test(value))) {
    return [];
  }
  return [AI_OUTPUT_VALIDATION_CODES.invalidCompetencyId];
}

function textCodes(value: unknown, kind: AiOutputKind): Codes {
  if (value === undefined) {
    return [AI_OUTPUT_VALIDATION_CODES.missingField];
  }
  return isString(value)
    ? checkAiText(value.trim(), kind)
    : [AI_OUTPUT_VALIDATION_CODES.invalidType];
}

function resultCodes(value: unknown, kind: AiOutputKind): Codes {
  if (kind !== 'answer_assessment') {
    return [];
  }
  if (value === undefined) {
    return [AI_OUTPUT_VALIDATION_CODES.missingField];
  }
  return isAssessmentResult(value) ? [] : [AI_OUTPUT_VALIDATION_CODES.invalidAssessmentResult];
}

/** Every violation of a known-kind output, keyed by field; empty when the output is valid. */
function violationsOf(raw: RawAiOutput, request: AiOutputRequest): Record<string, Codes> {
  const allowed = AI_OUTPUT_FIELDS[raw.kind];
  const entries: Array<[string, Codes]> = [
    ...Object.keys(raw)
      .filter((field) => !allowed.includes(field))
      .map((field): [string, Codes] => [field, [AI_OUTPUT_VALIDATION_CODES.unknownField]]),
    ['hintLevel', hintLevelCodes(raw['hintLevel'], request.hintLevel)],
    ['competencyId', competencyIdCodes(raw['competencyId'])],
    ['text', textCodes(raw['text'], raw.kind)],
    ['result', resultCodes(raw['result'], raw.kind)],
  ];
  return Object.fromEntries(entries.filter(([, codes]) => codes.length > 0));
}

/** The checks that need no kind: the output is an object of this contract version with a known kind. */
function checkEnvelope(raw: unknown): AppResult<RawAiOutput, ValidationAppError> {
  if (!isPlainRecord(raw)) {
    return err(aiOutputRejected({ [WHOLE_OUTPUT]: [AI_OUTPUT_VALIDATION_CODES.notAnObject] }));
  }
  if (raw['version'] !== AI_OUTPUT_CONTRACT_VERSION) {
    return err(aiOutputRejected({ version: [AI_OUTPUT_VALIDATION_CODES.unsupportedVersion] }));
  }
  const kind = raw['kind'];
  if (kind === undefined) {
    return err(aiOutputRejected({ kind: [AI_OUTPUT_VALIDATION_CODES.missingField] }));
  }
  if (!isKind(kind)) {
    return err(aiOutputRejected({ kind: [AI_OUTPUT_VALIDATION_CODES.unknownKind] }));
  }
  return ok({ ...raw, kind });
}

/** Builds the output from fields the checks accepted; the stored text is trimmed. */
function toAiOutput(raw: RawAiOutput, request: AiOutputRequest): AiOutput {
  const { competencyId, result, text } = raw;
  invariant(isString(text), 'validateAiOutput: an unchecked text reached the mapper.');
  const base: AiOutputBase = {
    version: AI_OUTPUT_CONTRACT_VERSION,
    hintLevel: request.hintLevel,
    text: text.trim(),
    ...(isString(competencyId) ? { competencyId } : {}),
  };
  if (request.kind !== 'answer_assessment') {
    return { ...base, kind: request.kind };
  }
  invariant(
    isAssessmentResult(result),
    'validateAiOutput: an unchecked result reached the mapper.',
  );
  return { ...base, kind: request.kind, result };
}

/**
 * Validates raw, untrusted AI output (already JSON-parsed) against the output contract and the
 * request it answers. Rejects an unknown version, kind or field, a kind or hint level other than the
 * requested one, a text that is empty, too long or contains links, markup or code, and an assessment
 * result outside the allowlist. A rejection lists every violation by field; the caller then uses a
 * predefined fallback for the requested kind and level (#10). It does not check for a leaked
 * solution; that guard (#31) runs on the returned output.
 */
export function validateAiOutput(
  raw: unknown,
  request: AiOutputRequest,
): AppResult<AiOutput, ValidationAppError> {
  return checkEnvelope(raw).andThen((output) => {
    if (output.kind !== request.kind) {
      return err(aiOutputRejected({ kind: [AI_OUTPUT_VALIDATION_CODES.unexpectedKind] }));
    }
    const violations = violationsOf(output, request);
    return Object.keys(violations).length > 0
      ? err(aiOutputRejected(violations))
      : ok(toAiOutput(output, request));
  });
}
