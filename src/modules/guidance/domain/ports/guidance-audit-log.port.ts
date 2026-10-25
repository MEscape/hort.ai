import type { ActorId, TenantId } from '@modules/auth';

import type { TopicClassifierName } from './topic-classifier.port';
import type { AssessmentResult } from '../ai-output/ai-output';
import type { FeedbackKind } from '../models/feedback-request';
import type { HintFallbackReason } from '../models/hint-fallback-reason';
import type { HintLevel } from '../models/hint-level';
import type { HintSubject } from '../models/hint-subject';
import type { ChildProfileId } from '../models/ids';
import type { ChildMessageIntent, TopicDecision, TopicGuess } from '../topic/topic-classification';

/** A confidence reduced to what operations need to tune the thresholds; never the exact value. */
export type ConfidenceBucket = 'low' | 'medium' | 'high';

/**
 * What operations must see about hints. Never the child's input or the AI's text: only ids, the level,
 * how a request ended, why the fallback was used, and the stable rejection codes (#11).
 */
export type GuidanceEvent =
  | {
      readonly type: 'guidance.hint_fallback_used';
      readonly level: HintLevel;
      readonly reason: HintFallbackReason;
      readonly codes: readonly string[];
    }
  | {
      readonly type: 'guidance.feedback_fallback_used';
      readonly kind: FeedbackKind;
      readonly level: HintLevel;
      readonly reason: HintFallbackReason;
      readonly codes: readonly string[];
    }
  | {
      readonly type: 'guidance.grounding_unavailable';
      readonly level: HintLevel;
      readonly code: string;
    }
  | {
      readonly type: 'guidance.hint_requested';
      readonly tenantId: TenantId;
      readonly actorId: ActorId;
      readonly childProfileId: ChildProfileId;
      readonly level: HintLevel;
      readonly outcome: 'generated' | 'fallback';
    }
  | {
      readonly type: 'guidance.answer_checked';
      readonly tenantId: TenantId;
      readonly actorId: ActorId;
      readonly childProfileId: ChildProfileId;
      readonly level: HintLevel;
      /** `null`: no key and the AI could not assess. */
      readonly result: AssessmentResult | null;
      readonly assessedBy: 'solution_key' | 'ai' | null;
    }
  | {
      /** The topic classification (#92) could not be used; the session goes ahead as homework. */
      readonly type: 'guidance.topic_classification_fallback_used';
      readonly reason: 'timeout' | 'provider_unavailable' | 'invalid_output';
      readonly codes: readonly string[];
    }
  | {
      readonly type: 'guidance.topic_classified';
      readonly classifiedBy: TopicClassifierName;
      readonly intent: ChildMessageIntent;
      readonly intentConfidence: ConfidenceBucket;
      readonly topic: TopicGuess['kind'];
      readonly topicConfidence: ConfidenceBucket | null;
      readonly action: TopicDecision['action'];
    }
  | {
      readonly type: 'guidance.child_task_classified';
      readonly tenantId: TenantId;
      readonly actorId: ActorId;
      readonly childProfileId: ChildProfileId;
      readonly action: TopicDecision['action'];
      readonly classifiedBy: TopicClassifierName | 'fallback';
    }
  | {
      /** Only logged: the subject the child picked wins. */
      readonly type: 'guidance.topic_subject_mismatch';
      readonly picked: HintSubject;
      readonly classified: HintSubject;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface GuidanceAuditLog {
  record(event: GuidanceEvent): void;
}
