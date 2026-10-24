import { literalGuard } from '@lib/utils';

/** The 16 German federal states, by the lower-case suffix of their ISO 3166-2:DE code. */
export const CURRICULUM_FEDERAL_STATES = [
  'bw',
  'by',
  'be',
  'bb',
  'hb',
  'hh',
  'he',
  'mv',
  'ni',
  'nw',
  'rp',
  'sl',
  'sn',
  'st',
  'sh',
  'th',
] as const;
export type CurriculumFederalState = (typeof CURRICULUM_FEDERAL_STATES)[number];
export const isCurriculumFederalState = literalGuard(CURRICULUM_FEDERAL_STATES);

export const CURRICULUM_SUBJECTS = ['math', 'german', 'general_studies', 'english'] as const;
export type CurriculumSubject = (typeof CURRICULUM_SUBJECTS)[number];
export const isCurriculumSubject = literalGuard(CURRICULUM_SUBJECTS);

/** Primary school: grades 1 to 4. */
export const CURRICULUM_GRADE_MIN = 1;
export const CURRICULUM_GRADE_MAX = 4;

export function isCurriculumGrade(value: number): boolean {
  return (
    Number.isInteger(value) && value >= CURRICULUM_GRADE_MIN && value <= CURRICULUM_GRADE_MAX
  );
}

/** Where a text comes from: an official curriculum (#28) or a teacher's upload for one class (#29). */
export const CURRICULUM_ORIGINS = ['official', 'teacher-material'] as const;
export type CurriculumOrigin = (typeof CURRICULUM_ORIGINS)[number];

/**
 * Hard bounds for ingested text. Curriculum and teacher text is untrusted data: every statement is
 * short, so it can only ever be a few lines inside the AI's data block, never a prompt of its own.
 */
export const CURRICULUM_TEXT_LIMITS = {
  /** A whole source text; larger input is rejected, not truncated. */
  sourceTextMax: 200_000,
  /** One competency statement; a longer one is cut at a word boundary. */
  statementMax: 400,
  /** A statement shorter than this is a fragment (a page number, a stray heading) and is dropped. */
  statementMin: 8,
  /** Statements per document. */
  statementsMax: 500,
  sectionMax: 200,
  titleMax: 300,
  versionMax: 32,
} as const;

/** Stable, URL-safe keys (document source key, competency code); matches the database check. */
export const CURRICULUM_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
