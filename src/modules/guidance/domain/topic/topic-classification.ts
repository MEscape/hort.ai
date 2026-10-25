import type { HintSubject } from '../models/hint-subject';

/** The contract version of a topic classification (#92). A breaking change bumps it. */
export const TOPIC_CLASSIFICATION_VERSION = 1;

/** What the child's message is: a homework task, a curiosity question or small talk. */
export const CHILD_MESSAGE_INTENTS = ['homework', 'curiosity', 'small_talk'] as const;
export type ChildMessageIntent = (typeof CHILD_MESSAGE_INTENTS)[number];

/** The kinds of topic a classifier may name. */
export const TOPIC_KINDS = ['competency', 'open', 'none'] as const;

/** A probability from 0 to 1. Anything else (NaN, -0.1, "0.8") rejects the whole output. */
export type Confidence = number;

/**
 * The topic of a homework task: one of the candidate competencies of this request, an open label
 * (stored only, never treated as knowledge), or none.
 */
export type TopicGuess =
  | {
      readonly kind: 'competency';
      readonly competencyCode: string;
      readonly confidence: Confidence;
    }
  | { readonly kind: 'open'; readonly label: string; readonly confidence: Confidence }
  | { readonly kind: 'none' };

/** The island of the world a homework task belongs to: one of this request's offered islands. */
export interface AreaGuess {
  readonly areaId: string;
  readonly confidence: Confidence;
}

/** A classification that passed `validateTopicClassification`. */
export interface TopicClassification {
  readonly version: typeof TOPIC_CLASSIFICATION_VERSION;
  readonly intent: { readonly value: ChildMessageIntent; readonly confidence: Confidence };
  readonly subject: { readonly value: HintSubject; readonly confidence: Confidence } | null;
  readonly topic: TopicGuess;
  /** Optional in the output; `null` when the classifier named no island. */
  readonly area: AreaGuess | null;
}

/**
 * The backend's decision on a classification: help (with the competency, if one is sure enough),
 * one fixed clarifying question, or a fixed friendly redirect without a hint.
 */
export type TopicDecision =
  | {
      readonly action: 'help';
      readonly competencyCode: string | null;
      readonly openTopicLabel: string | null;
    }
  | { readonly action: 'clarify' }
  | { readonly action: 'redirect'; readonly intent: Exclude<ChildMessageIntent, 'homework'> };
