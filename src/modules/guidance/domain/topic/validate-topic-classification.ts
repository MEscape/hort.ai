import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { invariant, isFiniteNumber, isPlainObject, isString, oneOf } from '@lib/utils';

import { checkChildSafeText } from '../child-safety/check-child-safe-text';
import {
  TOPIC_CLASSIFICATION_VALIDATION_CODES as CODES,
  topicClassificationRejected,
} from '../errors/topic-classification-errors';
import { HINT_SUBJECTS } from '../models/hint-subject';

import {
  CHILD_MESSAGE_INTENTS,
  TOPIC_CLASSIFICATION_VERSION,
  TOPIC_KINDS,
} from './topic-classification';

import type {
  AreaGuess,
  Confidence,
  TopicClassification,
  TopicGuess,
} from './topic-classification';
import type { TopicClassificationValidationCode } from '../errors/topic-classification-errors';

/** The key a violation of the output as a whole is reported under. */
const WHOLE_OUTPUT = '$';

const TOP_FIELDS = ['version', 'intent', 'subject', 'topic', 'area'];
const AREA_FIELDS = ['areaId', 'confidence'];
const PART_FIELDS = ['value', 'confidence'];
const TOPIC_FIELDS = {
  competency: ['kind', 'competencyCode', 'confidence'],
  open: ['kind', 'label', 'confidence'],
  none: ['kind'],
} as const satisfies Record<(typeof TOPIC_KINDS)[number], readonly string[]>;

const OPEN_LABEL_MIN_LENGTH = 2;
const OPEN_LABEL_MAX_LENGTH = 40;
/**
 * Letters, digits, spaces and `-` only. That alone rules out links, markup, code and invisible
 * characters (the text rules of `ai-text-rules.ts`), so they need no check of their own here.
 */
const OPEN_LABEL_PATTERN = /^[\p{L}\p{Nd} -]+$/u;

const isIntent = oneOf(CHILD_MESSAGE_INTENTS);
const isSubject = oneOf(HINT_SUBJECTS);
const isTopicKind = oneOf(TOPIC_KINDS);

/** Collects a violation; the checks below report every one, then the caller decides. */
type Report = (field: string, code: TopicClassificationValidationCode) => void;

interface Context {
  /** The codes of the candidate competencies offered in this request; no other code is accepted. */
  readonly candidateCodes: ReadonlySet<string>;
  /** The islands offered in this request (none when the child picked one); no other is accepted. */
  readonly candidateAreaIds?: ReadonlySet<string>;
}

/** The object at `path`, or `undefined` after reporting it missing or of the wrong type. */
function objectAt(
  report: Report,
  raw: unknown,
  { path, allowed }: { readonly path: string; readonly allowed: readonly string[] },
): Record<string, unknown> | undefined {
  if (raw === undefined) {
    report(path, CODES.missingField);
    return undefined;
  }
  if (!isPlainObject(raw)) {
    report(path, CODES.invalidType);
    return undefined;
  }
  Object.keys(raw)
    .filter((field) => !allowed.includes(field))
    .forEach((field) => {
      report(path === '' ? field : `${path}.${field}`, CODES.unknownField);
    });
  return raw;
}

function confidenceAt(raw: unknown, path: string, report: Report): Confidence | undefined {
  if (raw === undefined) {
    report(path, CODES.missingField);
    return undefined;
  }
  if (!isFiniteNumber(raw) || raw < 0 || raw > 1) {
    report(path, CODES.invalidConfidence);
    return undefined;
  }
  return raw;
}

/** `value` from a closed list plus its confidence, as the intent and the subject both carry. */
function partAt<T extends string>(
  report: Report,
  raw: unknown,
  {
    path,
    isValue,
    invalid,
  }: {
    readonly path: string;
    readonly isValue: (value: unknown) => value is T;
    readonly invalid: TopicClassificationValidationCode;
  },
): { readonly value: T; readonly confidence: Confidence } | undefined {
  const part = objectAt(report, raw, { path, allowed: PART_FIELDS });
  if (part === undefined) {
    return undefined;
  }
  const value = part['value'];
  if (value === undefined) {
    report(`${path}.value`, CODES.missingField);
  } else if (!isValue(value)) {
    report(`${path}.value`, invalid);
  }
  const confidence = confidenceAt(part['confidence'], `${path}.confidence`, report);
  return isValue(value) && confidence !== undefined ? { value, confidence } : undefined;
}

/** Trimmed, NFKC, 2 to 40 letters, digits, spaces or `-`, child-safe; stored lower-cased. */
function openLabelAt(raw: unknown, report: Report): string | undefined {
  if (raw === undefined) {
    report('topic.label', CODES.missingField);
    return undefined;
  }
  if (!isString(raw)) {
    report('topic.label', CODES.invalidType);
    return undefined;
  }
  const label = raw.normalize('NFKC').trim();
  const length = Array.from(label).length;
  if (
    length < OPEN_LABEL_MIN_LENGTH ||
    length > OPEN_LABEL_MAX_LENGTH ||
    !OPEN_LABEL_PATTERN.test(label)
  ) {
    report('topic.label', CODES.invalidLabel);
    return undefined;
  }
  if (checkChildSafeText(label).length > 0) {
    report('topic.label', CODES.unsafeLabel);
    return undefined;
  }
  return label.toLowerCase();
}

/**
 * Only a code offered in this request is accepted. That proves the competency exists and belongs
 * to the child's own state, grade and class; a code from anywhere else is rejected, however real.
 */
function competencyCodeAt(raw: unknown, context: Context, report: Report): string | undefined {
  if (raw === undefined) {
    report('topic.competencyCode', CODES.missingField);
    return undefined;
  }
  if (!isString(raw)) {
    report('topic.competencyCode', CODES.invalidType);
    return undefined;
  }
  if (!context.candidateCodes.has(raw)) {
    report('topic.competencyCode', CODES.unknownCompetency);
    return undefined;
  }
  return raw;
}

function topicAt(raw: unknown, context: Context, report: Report): TopicGuess | undefined {
  if (raw === undefined) {
    report('topic', CODES.missingField);
    return undefined;
  }
  if (!isPlainObject(raw)) {
    report('topic', CODES.invalidType);
    return undefined;
  }
  const kind = raw['kind'];
  if (!isTopicKind(kind)) {
    report('topic.kind', kind === undefined ? CODES.missingField : CODES.invalidTopicKind);
    return undefined;
  }
  objectAt(report, raw, { path: 'topic', allowed: TOPIC_FIELDS[kind] });
  if (kind === 'none') {
    return { kind };
  }
  const confidence = confidenceAt(raw['confidence'], 'topic.confidence', report);
  if (kind === 'competency') {
    const competencyCode = competencyCodeAt(raw['competencyCode'], context, report);
    return competencyCode === undefined || confidence === undefined
      ? undefined
      : { kind, competencyCode, confidence };
  }
  const label = openLabelAt(raw['label'], report);
  return label === undefined || confidence === undefined ? undefined : { kind, label, confidence };
}

/** An island offered in this request, with its confidence; absent or `null` is no island. */
function areaAt(raw: unknown, context: Context, report: Report): AreaGuess | null | undefined {
  if (raw === undefined || raw === null) {
    return null;
  }
  const area = objectAt(report, raw, { path: 'area', allowed: AREA_FIELDS });
  if (area === undefined) {
    return undefined;
  }
  const areaId = area['areaId'];
  if (areaId === undefined) {
    report('area.areaId', CODES.missingField);
  } else if (!isString(areaId)) {
    report('area.areaId', CODES.invalidType);
  } else if (!(context.candidateAreaIds?.has(areaId) ?? false)) {
    report('area.areaId', CODES.unknownArea);
  }
  const confidence = confidenceAt(area['confidence'], 'area.confidence', report);
  return isString(areaId) && confidence !== undefined ? { areaId, confidence } : undefined;
}

/**
 * Validates a raw, untrusted topic classification (#92) against its contract and the request it
 * answers. Rejects anything that is not an object of version 1, an unknown field at any level, an
 * intent or subject outside the closed lists, a confidence outside 0 to 1, a competency that was
 * not one of this request's candidates, an island that was not offered, an open label that is not
 * a short, safe plain label, and a topic or island on a message that is not homework. A rejection lists every violation by field; the caller
 * then proceeds without a classification (homework, no competency).
 */
export function validateTopicClassification(
  raw: unknown,
  context: Context,
): AppResult<TopicClassification, ValidationAppError> {
  if (!isPlainObject(raw)) {
    return err(topicClassificationRejected({ [WHOLE_OUTPUT]: [CODES.notAnObject] }));
  }
  if (raw['version'] !== TOPIC_CLASSIFICATION_VERSION) {
    return err(topicClassificationRejected({ version: [CODES.unsupportedVersion] }));
  }
  // A Map, because a field name comes from the output: `__proto__` must stay an ordinary key.
  const violations = new Map<string, TopicClassificationValidationCode[]>();
  const report: Report = (field, code) => {
    violations.set(field, [...(violations.get(field) ?? []), code]);
  };
  objectAt(report, raw, { path: '', allowed: TOP_FIELDS });
  const intent = partAt(report, raw['intent'], {
    path: 'intent',
    isValue: isIntent,
    invalid: CODES.invalidIntent,
  });
  const subject =
    raw['subject'] === null
      ? null
      : partAt(report, raw['subject'], {
          path: 'subject',
          isValue: isSubject,
          invalid: CODES.invalidSubject,
        });
  const topic = topicAt(raw['topic'], context, report);
  if (
    intent !== undefined &&
    intent.value !== 'homework' &&
    topic !== undefined &&
    topic.kind !== 'none'
  ) {
    report('topic', CODES.inconsistentTopic);
  }
  const area = areaAt(raw['area'], context, report);
  if (intent !== undefined && intent.value !== 'homework' && area !== null && area !== undefined) {
    report('area', CODES.inconsistentTopic);
  }
  if (violations.size > 0) {
    return err(topicClassificationRejected(Object.fromEntries(violations)));
  }
  invariant(
    intent !== undefined && subject !== undefined && topic !== undefined && area !== undefined,
    'validateTopicClassification: an unchecked part reached the mapper.',
  );
  return ok({ version: TOPIC_CLASSIFICATION_VERSION, intent, subject, topic, area });
}
