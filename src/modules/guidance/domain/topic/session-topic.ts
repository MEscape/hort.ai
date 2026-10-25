import type { ChildMessageIntent, TopicDecision } from './topic-classification';
import type { TopicClassifierName } from '../ports/topic-classifier.port';

/**
 * How a help session opens (#92): one fixed clarifying question, or a fixed friendly redirect for
 * small talk and curiosity questions. No opening means help as usual.
 */
export type SessionOpening =
  | { readonly kind: 'clarify' }
  | { readonly kind: 'redirect'; readonly intent: Exclude<ChildMessageIntent, 'homework'> };

/** What the topic classification decided for a session, as it is stored with it. */
export interface SessionTopic {
  /** `null` when the classification could not be used, or for a session from before #92. */
  readonly intent: ChildMessageIntent | null;
  readonly opening: SessionOpening | null;
  /** One of the request's candidate competencies; the only topic that counts as knowledge. */
  readonly competencyCode: string | null;
  /** Stored only: never grounds a hint, never shown, never a competency. */
  readonly openTopicLabel: string | null;
  /** `null` for a session from before #92. */
  readonly classifiedBy: TopicClassifierName | 'fallback' | null;
  /**
   * The world island the task belongs to: the one the child started from, or a sure classification
   * of a task the backend helps with. `null` when neither; it is what clears the island's mist.
   */
  readonly areaId: string | null;
  /** One of that island's own places, only when the child picked it. */
  readonly placeId: string | null;
}

/** The topic of a session that was never classified. */
export const UNCLASSIFIED_TOPIC: SessionTopic = {
  intent: null,
  opening: null,
  competencyCode: null,
  openTopicLabel: null,
  classifiedBy: null,
  areaId: null,
  placeId: null,
};

/** The stored form of a decision. */
export function toSessionTopic({
  decision,
  intent,
  classifiedBy,
  areaId,
}: {
  readonly decision: TopicDecision;
  readonly intent: ChildMessageIntent | null;
  readonly classifiedBy: TopicClassifierName | 'fallback';
  readonly areaId: string | null;
}): SessionTopic {
  const base = { ...UNCLASSIFIED_TOPIC, intent, classifiedBy, areaId };
  switch (decision.action) {
    case 'help':
      return {
        ...base,
        competencyCode: decision.competencyCode,
        openTopicLabel: decision.openTopicLabel,
      };
    case 'clarify':
      return { ...base, opening: { kind: 'clarify' } };
    case 'redirect':
      return { ...base, opening: { kind: 'redirect', intent: decision.intent } };
  }
}
