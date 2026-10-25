import { FALLBACK_AREA_ID, resolveArea } from '@modules/world';

import type { TopicClassification, TopicDecision } from './topic-classification';
import type { HintSubject } from '../models/hint-subject';

/** Below this the backend is not sure what the message is, and asks once. */
const INTENT_CONFIDENCE_MIN = 0.6;
/** From this a topic is recorded: a competency for grounding and learning events, or an open label. */
const TOPIC_CONFIDENCE_MIN = 0.7;
/** Between this and `TOPIC_CONFIDENCE_MIN` the topic is unclear, and the backend asks once. */
const TOPIC_CONFIDENCE_UNSURE = 0.4;
/** From this a subject other than the one the child picked is logged; the child's choice still wins. */
const SUBJECT_MISMATCH_CONFIDENCE = 0.8;

const HELP_WITHOUT_TOPIC: TopicDecision = {
  action: 'help',
  competencyCode: null,
  openTopicLabel: null,
};

/**
 * Decides how Hort.ai opens a help session from a validated classification (#92). Thresholds are
 * the named constants above (docs/architecture/topic-classification.md). The child is asked at most
 * once: once a clarifying question was asked, an unsure answer falls through to help without a
 * competency, so the child is never stuck in a loop. An open label is kept, never a competency.
 */
export function decideTopic(
  classification: TopicClassification,
  { clarificationAlreadyAsked }: { readonly clarificationAlreadyAsked: boolean },
): TopicDecision {
  const clarifyOnce = (): TopicDecision =>
    clarificationAlreadyAsked ? HELP_WITHOUT_TOPIC : { action: 'clarify' };
  const { intent, topic } = classification;
  if (intent.confidence < INTENT_CONFIDENCE_MIN) {
    return clarifyOnce();
  }
  if (intent.value !== 'homework') {
    return { action: 'redirect', intent: intent.value };
  }
  if (topic.kind === 'none' || topic.confidence < TOPIC_CONFIDENCE_UNSURE) {
    return HELP_WITHOUT_TOPIC;
  }
  if (topic.confidence < TOPIC_CONFIDENCE_MIN) {
    return clarifyOnce();
  }
  return topic.kind === 'competency'
    ? { action: 'help', competencyCode: topic.competencyCode, openTopicLabel: null }
    : { action: 'help', competencyCode: null, openTopicLabel: topic.label };
}

/**
 * The island a session's homework belongs to, or `null`: only for a task the backend helps with, only
 * at `resolveArea`'s confidence of 0.7 and never the fallback island, which only means "unsure".
 * An island the child picked is not decided here: it always wins (`classifySessionTask`).
 */
export function decideArea({ area }: TopicClassification, decision: TopicDecision): string | null {
  if (decision.action !== 'help' || area === null) {
    return null;
  }
  const resolved = resolveArea(area.areaId, area.confidence);
  return resolved.id === FALLBACK_AREA_ID ? null : resolved.id;
}

/** A confidently different subject than the child picked. Only logged: the child's choice wins. */
export function isSubjectMismatch(
  classification: TopicClassification,
  picked: HintSubject,
): boolean {
  const { subject } = classification;
  return (
    subject !== null &&
    subject.value !== picked &&
    subject.confidence >= SUBJECT_MISMATCH_CONFIDENCE
  );
}

/** A confidence by the decision bands, for logs: exact values and texts never leave the backend. */
export function confidenceBucketOf(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < TOPIC_CONFIDENCE_UNSURE) {
    return 'low';
  }
  return confidence < TOPIC_CONFIDENCE_MIN ? 'medium' : 'high';
}
