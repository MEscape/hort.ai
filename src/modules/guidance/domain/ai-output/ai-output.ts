import type { HintLevel } from '../models/hint-level';

/**
 * The data contract for everything the AI may return (#6, docs/architecture/ai-output-contract.md).
 * AI output is untrusted: it becomes an `AiOutput` only through `validateAiOutput`. The AI words a
 * thinking prompt, a hint, praise, a comprehension question or an answer assessment; it never decides
 * state, and it never returns code, markup or links.
 */

/** Bumped on every breaking change; an output carrying another version is rejected. */
export const AI_OUTPUT_CONTRACT_VERSION = 1;

/** The allowlisted output kinds. Anything else is rejected. */
export const AI_OUTPUT_KINDS = [
  'thinking_prompt',
  'hint',
  'praise',
  'comprehension_question',
  'answer_assessment',
] as const;

export type AiOutputKind = (typeof AI_OUTPUT_KINDS)[number];

/** The only results an answer assessment may carry (#14). */
export const ASSESSMENT_RESULTS = ['correct', 'partly_correct', 'not_yet'] as const;

export type AssessmentResult = (typeof ASSESSMENT_RESULTS)[number];

/** Maximum text length per kind, in characters (code points). Short enough to read aloud to a child. */
export const AI_TEXT_MAX_LENGTH: Readonly<Record<AiOutputKind, number>> = {
  thinking_prompt: 200,
  hint: 280,
  praise: 160,
  comprehension_question: 160,
  answer_assessment: 200,
};

/** A curriculum competency reference (#28): a short lowercase identifier, never free text. */
export const COMPETENCY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Fields every kind carries. `competencyId` is optional until the curriculum ingestion (#28) exists. */
export interface AiOutputBase {
  readonly version: typeof AI_OUTPUT_CONTRACT_VERSION;
  readonly hintLevel: HintLevel;
  readonly competencyId?: string;
  readonly text: string;
}

/** The kinds that carry only text: thinking prompt, hint, praise and comprehension question. */
export type AiTextKind = Exclude<AiOutputKind, 'answer_assessment'>;

export interface AiTextOutput extends AiOutputBase {
  readonly kind: AiTextKind;
}

/** An assessment of the child's own answer: an allowlisted result plus a short text without the solution. */
export interface AnswerAssessment extends AiOutputBase {
  readonly kind: 'answer_assessment';
  readonly result: AssessmentResult;
}

/** A validated AI output. */
export type AiOutput = AiTextOutput | AnswerAssessment;

/** The fields each kind may carry. A field outside this list rejects the whole output. */
export const AI_OUTPUT_FIELDS: Readonly<Record<AiOutputKind, readonly string[]>> = {
  thinking_prompt: ['version', 'kind', 'hintLevel', 'competencyId', 'text'],
  hint: ['version', 'kind', 'hintLevel', 'competencyId', 'text'],
  praise: ['version', 'kind', 'hintLevel', 'competencyId', 'text'],
  comprehension_question: ['version', 'kind', 'hintLevel', 'competencyId', 'text'],
  answer_assessment: ['version', 'kind', 'hintLevel', 'competencyId', 'text', 'result'],
};

/** What the backend asked the AI for. The output must match it; the AI never chooses kind or level. */
export interface AiOutputRequest {
  readonly kind: AiOutputKind;
  readonly hintLevel: HintLevel;
}
