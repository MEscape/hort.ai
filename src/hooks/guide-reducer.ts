/**
 * The state machine of a companion that guides: it points at something, says one line, and goes
 * home. Pure and screen-agnostic (targets and lines are the caller's own keys), so any child
 * screen can reuse it through `useGuide`. One line at a time: a new point replaces the current
 * one at once, nothing queues.
 */

import { clamp } from '@lib/utils';

export type GuidePhase = 'home' | 'walking' | 'speaking' | 'returning';

export interface GuideState {
  readonly phase: GuidePhase;
  readonly target: string | null;
  readonly line: string | null;
  /** Whether it left its home spot for this line (it does not in calm mode or when the target is home). */
  readonly hasMoved: boolean;
  /** Grows with every point, so timers of an earlier line can tell they are stale. */
  readonly seq: number;
}

export type GuideAction =
  | {
      readonly type: 'point';
      readonly target: string;
      readonly line: string;
      readonly moves: boolean;
    }
  | { readonly type: 'arrived'; readonly seq?: number }
  | { readonly type: 'spoken'; readonly seq?: number }
  | { readonly type: 'returned'; readonly seq?: number }
  | { readonly type: 'stop' };

export const INITIAL_GUIDE: GuideState = {
  phase: 'home',
  target: null,
  line: null,
  hasMoved: false,
  seq: 0,
};

/** The bubble exists only while a line is being said. */
export const isGuideSpeaking = (state: GuideState): boolean => state.phase === 'speaking';

const MIN_DWELL_MS = 3200;
const MAX_DWELL_MS = 6500;
const READING_MS_PER_CHARACTER = 90;

/** How long a line stays up: long enough to read it slowly, never long enough to wait for it. */
export function dwellMsFor(text: string): number {
  return clamp(text.length * READING_MS_PER_CHARACTER, MIN_DWELL_MS, MAX_DWELL_MS);
}

const heading = (state: GuideState): GuideState => ({
  ...state,
  phase: state.hasMoved ? 'returning' : 'home',
  line: null,
  target: state.hasMoved ? state.target : null,
});

/** A timer of an earlier line (its `seq` is no longer the state's) must not touch a newer one. */
const isStale = (state: GuideState, action: GuideAction): boolean =>
  'seq' in action && action.seq !== state.seq;

export function guideReducer(state: GuideState, action: GuideAction): GuideState {
  if (isStale(state, action)) {
    return state;
  }
  switch (action.type) {
    case 'point':
      return {
        phase: action.moves ? 'walking' : 'speaking',
        target: action.target,
        line: action.line,
        hasMoved: action.moves,
        seq: state.seq + 1,
      };
    case 'arrived':
      return state.phase === 'walking' ? { ...state, phase: 'speaking' } : state;
    case 'spoken':
      return state.phase === 'speaking' ? heading(state) : state;
    case 'stop':
      return state.phase === 'home' ? state : heading({ ...state, seq: state.seq + 1 });
    case 'returned':
      return state.phase === 'returning' ? { ...INITIAL_GUIDE, seq: state.seq } : state;
  }
}
