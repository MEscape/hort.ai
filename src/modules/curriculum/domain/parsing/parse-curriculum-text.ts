import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import type { ValidationAppError } from '@lib/errors';

import { curriculumInvalid, CURRICULUM_VALIDATION_CODES } from '../errors/curriculum-errors';
import {
  CURRICULUM_KEY_PATTERN,
  CURRICULUM_TEXT_LIMITS,
  isCurriculumFederalState,
  isCurriculumGrade,
  isCurriculumSubject,
} from '../models/curriculum-scope';

import { extractStatements } from './extract-statements';
import { toCleanLine } from './untrusted-text';

import type { CurriculumDocumentDraft, CurriculumSource } from '../models/competency';

const CODES = CURRICULUM_VALIDATION_CODES;
const HEADER = /^---\n([\s\S]*?)\n---\n/;
const GRADES = /^([1-4])\s*-\s*([1-4])$|^([1-4])$/;
/** `all` marks a document valid in every state: the fallback (KMK). */
const ALL_STATES = 'all';

type Header = Readonly<Record<string, string>>;

function readHeader(block: string): Header {
  const header: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      header[line.slice(0, separator).trim().toLowerCase()] = toCleanLine(line.slice(separator + 1));
    }
  }
  return header;
}

function required(header: Header, field: string, max: number): AppResult<string, ValidationAppError> {
  const value = header[field] ?? '';
  if (value.length === 0) {
    return err(curriculumInvalid(field, CODES.required));
  }
  return value.length > max ? err(curriculumInvalid(field, CODES.tooLong)) : ok(value);
}

function gradesOf(header: Header): AppResult<[number, number], ValidationAppError> {
  const match = GRADES.exec(header['grades'] ?? '');
  const from = Number(match?.[1] ?? match?.[3]);
  const to = Number(match?.[2] ?? match?.[3]);
  return match && isCurriculumGrade(from) && isCurriculumGrade(to) && from <= to
    ? ok([from, to])
    : err(curriculumInvalid('grades', CODES.invalid));
}

function sourceOf(header: Header): AppResult<CurriculumSource, ValidationAppError> {
  const sourceKey = header['source-key'] ?? '';
  const state = (header['federal-state'] ?? '').toLowerCase();
  const subject = (header['subject'] ?? '').toLowerCase();
  const url = header['source-url'] ?? '';
  if (!CURRICULUM_KEY_PATTERN.test(sourceKey)) {
    return err(curriculumInvalid('source-key', CODES.invalid));
  }
  if (state !== ALL_STATES && !isCurriculumFederalState(state)) {
    return err(curriculumInvalid('federal-state', CODES.invalid));
  }
  if (!isCurriculumSubject(subject)) {
    return err(curriculumInvalid('subject', CODES.invalid));
  }
  if (url.length > 0 && !/^https:\/\/\S{1,500}$/.test(url)) {
    return err(curriculumInvalid('source-url', CODES.invalid));
  }
  return required(header, 'version', CURRICULUM_TEXT_LIMITS.versionMax).andThen((version) =>
    required(header, 'title', CURRICULUM_TEXT_LIMITS.titleMax).andThen((title) =>
      gradesOf(header).map(([gradeFrom, gradeTo]) => ({
        origin: 'official' as const,
        sourceKey,
        version,
        title,
        federalState: isCurriculumFederalState(state) ? state : null,
        subject,
        gradeFrom,
        gradeTo,
        sourceUrl: url.length > 0 ? url : null,
      })),
    ),
  );
}

/**
 * Parses an official curriculum source text (#28): a `---` header with `source-key`, `version`,
 * `title`, `federal-state` (`he`, … or `all`), `subject`, `grades` (`3-4`) and `source-url`, then the
 * body `extractStatements` reads. The whole text is untrusted and bounded before anything is read.
 */
export function parseCurriculumText(raw: string): AppResult<CurriculumDocumentDraft, ValidationAppError> {
  if (raw.length > CURRICULUM_TEXT_LIMITS.sourceTextMax) {
    return err(curriculumInvalid('text', CODES.tooLong));
  }
  const text = raw.replace(/\r\n?/g, '\n');
  const header = HEADER.exec(text);
  if (!header) {
    return err(curriculumInvalid('header', CODES.required));
  }
  const statements = extractStatements(text.slice(header[0].length));
  if (statements.length === 0) {
    return err(curriculumInvalid('text', CODES.noStatements));
  }
  if (statements.length > CURRICULUM_TEXT_LIMITS.statementsMax) {
    return err(curriculumInvalid('text', CODES.tooManyStatements));
  }
  return sourceOf(readHeader(header[1] ?? '')).map((source) => ({ source, statements }));
}
