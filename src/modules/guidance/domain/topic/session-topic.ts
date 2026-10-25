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
}

/** The topic of a session that was never classified. */
export const UNCLASSIFIED_TOPIC: SessionTopic = {
  intent: null,
  opening: null,
  competencyCode: null,
  openTopicLabel: null,
  classifiedBy: null,
};

/** The stored form of a decision. */
export function toSessionTopic({
  decision,
  intent,
  classifiedBy,
}: {
  readonly decision: TopicDecision;
  readonly intent: ChildMessageIntent | null;
  readonly classifiedBy: TopicClassifierName | 'fallback';
}): SessionTopic {
  const base = { ...UNCLASSIFIED_TOPIC, intent, classifiedBy };
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
