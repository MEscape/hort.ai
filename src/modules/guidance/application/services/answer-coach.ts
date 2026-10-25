import { invariant } from '@lib/utils';

import { checkAgainstSolutionKey } from '../../domain/answer-check/check-against-solution-key';
import { expressionsIn, readMath } from '../../domain/solution-leak/read-math';

import { judgeAiAnswer } from './judge-ai-answer';

import type { Verdict } from './judge-ai-answer';
import type { AssessmentResult } from '../../domain/ai-output/ai-output';
import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { FeedbackKind, FeedbackRequest } from '../../domain/models/feedback-request';
import type { HintLevel } from '../../domain/models/hint-level';
import type { CurriculumCompetency } from '../../domain/models/hint-request';
import type { FeedbackProvider } from '../../domain/ports/feedback-provider.port';
import type { GuidanceAuditLog } from '../../domain/ports/guidance-audit-log.port';
import type { SafetyClassifier } from '../../domain/ports/safety-classifier.port';
import type { AnswerFeedback, AssessedBy, FeedbackText } from '../contracts/answer-views';

type Rejection = Exclude<Verdict, { readonly output: unknown }>;

/** "Rechne", "Rechne aus:", "Was ist" … in front of the expression, and "= ?" or "." after it. */
const LEADING_IMPERATIVE =
  /^(?:rechne(?:\s+aus)?|berechne|löse|was\s+ist|wie\s+viel\s+ist|what\s+is|calculate)\s*:?\s*/iu;
const TRAILING_ASK = /\s*(?:=\s*\??|[?.!])\s*$/u;
/** Whole numbers joined by + − · × * : and nothing else: no brackets, labels or other words. */
const BARE_EXPRESSION = /^\d{1,6}(?:\s*[-+−·×*:]\s*\d{1,6})+$/u;

/**
 * The result of a task that is nothing but one arithmetic expression ("Rechne 23 + 24 = ?"), which
 * then decides like a teacher's key: the AI's assessment is only a proposal. `null` for anything
 * else (a word problem, a task label such as "Aufgabe 2:", brackets, an estimate, "Tauschaufgabe"),
 * for a division with a remainder, and for a negative result, so the validated AI decides those.
 */
function computedKey(task: string): string | null {
  const bare = task.trim().replace(LEADING_IMPERATIVE, '').replace(TRAILING_ASK, '');
  if (!BARE_EXPRESSION.test(bare)) {
    return null;
  }
  const [value, ...more] = expressionsIn(readMath(bare));
  return value === undefined || more.length > 0 || value < 0 || !Number.isInteger(value)
    ? null
    : String(value);
}

/** The result and who decided it, or no result when the AI could not assess; plus any AI text. */
type Assessment =
  | {
      readonly result: AssessmentResult;
      readonly assessedBy: AssessedBy;
      readonly message: FeedbackText | null;
    }
  | { readonly result: null; readonly assessedBy: null; readonly message: FeedbackText };

export interface AnswerCoachDependencies {
  readonly provider: FeedbackProvider;
  readonly audit: GuidanceAuditLog;
  /** The second safety check (#11); without one only the word lists apply. */
  readonly safety?: SafetyClassifier;
}

/** One answer of the child to one task, with the teacher's key when the task is an assignment (#33). */
export interface AnswerToCheck {
  readonly task: ChildTaskText;
  readonly answer: ChildTaskText;
  /** Never passed to the AI and never shown to the child. */
  readonly solutionKey: string | null;
  readonly level: HintLevel;
  readonly competencies: readonly CurriculumCompetency[];
}

/**
 * Checks the child's own answer and words the feedback (#14). With a solution key (the teacher's,
 * or the computed result of the task's one written expression) the result is decided
 * deterministically against it; without one the AI assesses and its assessment must pass
 * the contract (#6) and the child-safety rules, which also reject punishing wording. Praise and the
 * comprehension question come from the AI under the same checks, each with its predefined fallback.
 * The solution-leak guard (#31) checks every AI text against the task and the key, so an assessment
 * cannot reveal the expected answer. It never fails and never states the solution; every fallback is logged with codes only.
 */
export class AnswerCoach {
  constructor(private readonly deps: AnswerCoachDependencies) {}

  async check(toCheck: AnswerToCheck): Promise<AnswerFeedback> {
    const { result, assessedBy, message } = await this.assess(toCheck);
    if (result === 'correct') {
      const [praise, question] = await Promise.all([
        this.word('praise', toCheck),
        this.word('comprehension_question', toCheck),
      ]);
      return { result, assessedBy, next: 'comprehension_question', praise, question };
    }
    return {
      result,
      assessedBy,
      next: 'hint_ladder',
      message: message ?? this.fallback('answer_assessment', toCheck.level, null),
    };
  }

  private async assess(toCheck: AnswerToCheck): Promise<Assessment> {
    const key = toCheck.solutionKey ?? computedKey(toCheck.task);
    if (key !== null) {
      // The key decides; the child gets the predefined, encouraging wording of the result.
      return {
        result: checkAgainstSolutionKey(toCheck.answer, key, toCheck.task),
        assessedBy: 'solution_key',
        message: null,
      };
    }
    const verdict = await this.ask('answer_assessment', toCheck);
    if ('output' in verdict) {
      invariant(
        verdict.output.kind === 'answer_assessment',
        'AnswerCoach: the contract let another kind through.',
      );
      return {
        result: verdict.output.result,
        assessedBy: 'ai',
        message: { kind: 'generated', text: verdict.output.text },
      };
    }
    return {
      result: null,
      assessedBy: null,
      message: this.fallback('answer_assessment', toCheck.level, verdict),
    };
  }

  private async word(kind: FeedbackKind, toCheck: AnswerToCheck): Promise<FeedbackText> {
    const verdict = await this.ask(kind, toCheck);
    return 'output' in verdict
      ? { kind: 'generated', text: verdict.output.text }
      : this.fallback(kind, toCheck.level, verdict);
  }

  private ask(kind: FeedbackKind, toCheck: AnswerToCheck) {
    const { task, answer, solutionKey, level, competencies } = toCheck;
    const request: FeedbackRequest = { kind, task, answer, level, competencies };
    return judgeAiAnswer({
      call: () => this.deps.provider.word(request),
      expected: { kind, hintLevel: level },
      solution: { task, solutionKey, answer },
      safety: this.deps.safety,
    });
  }

  /** The predefined text of a kind; logged when it replaces a rejected or missing AI answer. */
  private fallback(kind: FeedbackKind, level: HintLevel, rejected: Rejection | null): FeedbackText {
    if (rejected === null) {
      return { kind: 'predefined', feedback: kind, reason: null };
    }
    this.deps.audit.record({ type: 'guidance.feedback_fallback_used', kind, level, ...rejected });
    return { kind: 'predefined', feedback: kind, reason: rejected.reason };
  }
}
