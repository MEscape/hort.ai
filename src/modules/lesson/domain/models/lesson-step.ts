/**
 * The canvas-first lesson contract (R-021). A lesson step is a scene the child acts on, not a chat
 * message: one approved template with bounded parameters, the input it expects, and a reaction per
 * outcome drawn from closed vocabularies. Text travels as message keys of the `lesson` namespace,
 * so the same step can be drawn, spoken or shown as one line of side text (R-016, R-017).
 *
 * The answer key lives next to the step on the server only; views handed to a client never carry it.
 */
export const LESSON_SCHEMA_VERSION = 1;

/** Limits every template checks; a scene outside them is rejected, never drawn. */
export const FRACTION_LIMITS = { minParts: 2, maxParts: 8 } as const;

export interface Fraction {
  readonly numerator: number;
  readonly denominator: number;
}

/** Two bridges over the same river, each split into equal planks, some of them laid. */
export interface CompareBridgesScene {
  readonly template: 'compare-bridges';
  readonly sceneVersion: 1;
  readonly top: Fraction;
  readonly bottom: Fraction;
}

/** One bridge with empty plank slots; the child lays planks until the asked part is built. */
export interface BuildBridgeScene {
  readonly template: 'build-bridge';
  readonly sceneVersion: 1;
  readonly target: Fraction;
}

/** Number-line and groups limits: the numbers of grades 1 to 4. */
export const NUMBER_LINE_LIMITS = { max: 100, maxJump: 20 } as const;
export const GROUPS_LIMITS = { maxGroups: 10, maxEach: 10 } as const;

/**
 * A stretch of the number line with a marked start and a jump ("+7"); the child taps where the
 * jump lands. Plus and minus.
 */
export interface NumberLineScene {
  readonly template: 'number-line';
  readonly sceneVersion: 1;
  readonly start: number;
  /** Negative for minus. Never 0. */
  readonly jump: number;
}

/**
 * Plates with dots. `total`: every plate shows its dots and the child says how many there are in
 * all (times). `each`: the dots lie in one pile and the child says how many each plate gets when
 * they are shared fairly (divided by).
 */
export interface GroupsScene {
  readonly template: 'groups';
  readonly sceneVersion: 1;
  readonly groups: number;
  readonly each: number;
  readonly ask: 'total' | 'each';
}

export type Scene = CompareBridgesScene | BuildBridgeScene | NumberLineScene | GroupsScene;
export type SceneTemplate = Scene['template'];

export const COMPARE_CHOICES = ['top', 'bottom', 'same'] as const;
export type CompareChoice = (typeof COMPARE_CHOICES)[number];

/** What the child sends back: the structured event of the step's template. */
export type SceneAnswer =
  | { readonly kind: 'choose'; readonly choice: CompareChoice }
  | { readonly kind: 'fill'; readonly laid: number }
  | { readonly kind: 'number'; readonly value: number };

/** Longest typed answer the side panel takes: a word or a number, not an essay. */
export const TEXT_ANSWER_MAX_LENGTH = 80;

/**
 * What the child may send instead of acting on the scene: typed text from the side panel (and,
 * later, a speech transcript). It is read into a `SceneAnswer` by fixed rules, never by a model.
 */
export type ChildInput = SceneAnswer | { readonly kind: 'text'; readonly message: string };

export type Outcome = 'correct' | 'not_yet';

/** How the scene answers an outcome. Templates draw these; nothing free-form. */
export type SceneReaction =
  'celebrate' | 'wobble' | 'line-up' | 'count-planks' | 'count-steps' | 'deal-out';

/** The companion's state machine (idle, curious, thinking, cheer, oops-try-again). */
export type MascotState = 'idle' | 'curious' | 'thinking' | 'cheer' | 'oops';

export interface StepFeedback {
  /** Key under `lesson.lessons.<lessonId>.<stepId>`. */
  readonly line: string;
  readonly reaction: SceneReaction;
  readonly mascot: MascotState;
}

/**
 * Feedback per outcome. `hint` replaces `notYet` from the second miss on: the same idea through
 * another representation (R-006), never the answer and never anything taken away.
 */
export interface StepFeedbackSet {
  readonly correct: StepFeedback;
  readonly notYet: StepFeedback;
  readonly hint: StepFeedback;
}

export interface LessonStep {
  readonly id: string;
  readonly scene: Scene;
  /** One short spoken-style sentence, the key under the step. */
  readonly narration: string;
  readonly feedback: StepFeedbackSet;
}

export interface Lesson {
  readonly id: string;
  readonly version: number;
  readonly objectiveId: string;
  readonly steps: readonly LessonStep[];
  /** The idea named at the end ("the more parts, the smaller each one"), a key under the lesson. */
  readonly conclusion: string;
}
