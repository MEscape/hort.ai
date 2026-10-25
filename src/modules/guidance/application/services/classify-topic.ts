import { unique } from '@lib/utils';

import {
  confidenceBucketOf,
  decideTopic,
  isSubjectMismatch,
} from '../../domain/topic/decide-topic';
import { validateTopicClassification } from '../../domain/topic/validate-topic-classification';

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { CurriculumCompetency } from '../../domain/models/hint-request';
import type { HintSubject } from '../../domain/models/hint-subject';
import type { GuidanceAuditLog, GuidanceEvent } from '../../domain/ports/guidance-audit-log.port';
import type {
  TopicClassifier,
  TopicClassifierName,
} from '../../domain/ports/topic-classifier.port';
import type {
  ChildMessageIntent,
  TopicClassification,
  TopicDecision,
} from '../../domain/topic/topic-classification';

export interface ClassifyTopicDependencies {
  /** Without one (no `TYPESAFE_API_KEY`) every task goes ahead as today: homework, no competency. */
  readonly classifier?: TopicClassifier;
  readonly audit: GuidanceAuditLog;
}

/** A task text that already passed the safety checks, with what grounds it. */
export interface ChildTaskToClassify {
  readonly task: ChildTaskText;
  readonly subject: HintSubject;
  readonly candidates: readonly CurriculumCompetency[];
  readonly clarificationAlreadyAsked: boolean;
}

/** What the session start stores (#17): the decision, the intent and who classified. */
export interface ClassifiedChildTask {
  readonly decision: TopicDecision;
  /** `null` when the classification could not be used. */
  readonly intent: ChildMessageIntent | null;
  readonly classifiedBy: TopicClassifierName | 'fallback';
}

type FallbackEvent = Extract<
  GuidanceEvent,
  { type: 'guidance.topic_classification_fallback_used' }
>;

const TODAYS_FLOW: ClassifiedChildTask = {
  decision: { action: 'help', competencyCode: null, openTopicLabel: null },
  intent: null,
  classifiedBy: 'fallback',
};

/** Either a validated classification, or why it could not be used. */
async function classificationOf(
  classifier: TopicClassifier,
  request: ChildTaskToClassify,
): Promise<TopicClassification | Pick<FallbackEvent, 'reason' | 'codes'>> {
  const { task, subject, candidates } = request;
  try {
    return await classifier.classify({ task, subject, candidates }).match(
      (raw) =>
        validateTopicClassification(raw, {
          candidateCodes: new Set(candidates.map(({ code }) => code)),
        }).match(
          (classification) => classification,
          (rejection) => ({
            reason: 'invalid_output' as const,
            codes: unique(Object.values(rejection.fieldErrors).flat()),
          }),
        ),
      (failure) => ({
        reason:
          failure.kind === 'timeout' ? ('timeout' as const) : ('provider_unavailable' as const),
        codes: [],
      }),
    );
  } catch {
    // An adapter that throws instead of returning its failure must still not stop the session.
    return { reason: 'provider_unavailable', codes: [] };
  }
}

/**
 * Sorts the child's task into intent and curriculum topic (#92) and decides how the session opens:
 * classifier, then `validateTopicClassification`, then `decideTopic`. The caller runs it only on
 * text that passed the safety checks (#11), and nothing here can change a safety outcome. It
 * never fails: no classifier, a timeout, a provider error or a rejected output all end in today's
 * flow (homework, no competency). Logs carry codes, intent, decision and confidence buckets only,
 * never the task, a label or the classifier's answer.
 */
export async function classifyTopic(
  { classifier, audit }: ClassifyTopicDependencies,
  request: ChildTaskToClassify,
): Promise<ClassifiedChildTask> {
  const fallBack = (why: Pick<FallbackEvent, 'reason' | 'codes'>): ClassifiedChildTask => {
    audit.record({ type: 'guidance.topic_classification_fallback_used', ...why });
    return TODAYS_FLOW;
  };
  if (classifier === undefined) {
    return fallBack({ reason: 'provider_unavailable', codes: [] });
  }
  const classification = await classificationOf(classifier, request);
  if (!('version' in classification)) {
    return fallBack(classification);
  }
  if (classification.subject !== null && isSubjectMismatch(classification, request.subject)) {
    audit.record({
      type: 'guidance.topic_subject_mismatch',
      picked: request.subject,
      classified: classification.subject.value,
    });
  }
  const decision = decideTopic(classification, request);
  const { intent, topic } = classification;
  audit.record({
    type: 'guidance.topic_classified',
    classifiedBy: classifier.name,
    intent: intent.value,
    intentConfidence: confidenceBucketOf(intent.confidence),
    topic: topic.kind,
    topicConfidence: topic.kind === 'none' ? null : confidenceBucketOf(topic.confidence),
    action: decision.action,
  });
  return { decision, intent: intent.value, classifiedBy: classifier.name };
}
