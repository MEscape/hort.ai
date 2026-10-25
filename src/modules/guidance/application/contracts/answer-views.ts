import type { AssessmentResult } from '../../domain/ai-output/ai-output';
import type { AssessedBy as DomainAssessedBy } from '../../domain/models/assessed-by';
import type { FeedbackKind } from '../../domain/models/feedback-request';
import type { HintFallbackReason } from '../../domain/models/hint-fallback-reason';

/**
 * One piece of text for the child: validated AI text, or the predefined text of its kind. A
 * predefined text carries no text; presentation maps the kind (and the result) to the translated,
 * encouraging wording. `reason` says why the AI's text was not used, `null` when none was asked
 * for (the solution key decided).
 */
export type FeedbackText =
  | { readonly kind: 'generated'; readonly text: string }
  | {
      readonly kind: 'predefined';
      readonly feedback: FeedbackKind;
      readonly reason: HintFallbackReason | null;
    };

/** Who decided the result: the teacher's solution key, deterministically, or the AI's validated assessment. */
export type AssessedBy = DomainAssessedBy;

/**
 * The backend's answer to the child's own answer (#14). Correct: praise and one comprehension
 * question, and the task is understood only once the child replies to it. Partly correct, not yet,
 * or not assessable: an encouraging message and back to the hint ladder. Never the solution.
 */
export type AnswerFeedback =
  | {
      readonly result: 'correct';
      readonly assessedBy: AssessedBy;
      readonly next: 'comprehension_question';
      readonly praise: FeedbackText;
      readonly question: FeedbackText;
    }
  | {
      /** `null`: no key and the AI's assessment failed or was rejected. */
      readonly result: Exclude<AssessmentResult, 'correct'> | null;
      readonly assessedBy: AssessedBy | null;
      readonly next: 'hint_ladder';
      readonly message: FeedbackText;
    };
