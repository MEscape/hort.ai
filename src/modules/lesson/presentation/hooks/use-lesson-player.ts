'use client';

import { useState, useTransition } from 'react';

import { checkSceneAnswerAction } from '../actions/check-scene-answer-action';
import { REQUEST_FAILED_CODE } from '../messages/message-keys';

import { useLessonLines } from './use-lesson-lines';

import type { LessonLines } from './use-lesson-lines';
import type {
  ChildInput,
  MascotState,
  Outcome,
  StepFeedback,
} from '../../application/contracts/lesson-constraints';
import type { SceneChoice } from '../components/scene-view';
import type { LessonDto, LessonStepDto } from '../dto/lesson-dto';

/** One line of the side panel's transcript: what the companion said, or what the child wrote. */
export interface LogEntry {
  readonly id: number;
  readonly who: 'companion' | 'child';
  readonly text: string;
}

interface PlayerState {
  readonly index: number;
  readonly attempt: number;
  readonly outcome: Outcome | 'unclear' | null;
  readonly feedback: StepFeedback | null;
  /** The step the backend said comes next; `null` after the last one. */
  readonly nextStepId: string | null;
  readonly chosen: SceneChoice;
  readonly isFinished: boolean;
  readonly errorCode: string | null;
  /** Counts reactions, so a repeated one plays again. */
  readonly beat: number;
  readonly log: readonly LogEntry[];
}

function startState(lesson: LessonDto, lines: LessonLines, beat = 0): PlayerState {
  const first = lesson.steps[0];
  return {
    index: 0,
    attempt: 1,
    outcome: null,
    feedback: null,
    nextStepId: null,
    chosen: null,
    isFinished: false,
    errorCode: null,
    beat,
    log: first === undefined ? [] : [{ id: 0, who: 'companion', text: lines.narration(first) }],
  };
}

function append(log: readonly LogEntry[], ...entries: Array<Omit<LogEntry, 'id'>>): LogEntry[] {
  const nextId = (log.at(-1)?.id ?? 0) + 1;
  return [...log, ...entries.map((entry, offset) => ({ ...entry, id: nextId + offset }))];
}

export interface LessonPlayer {
  readonly step: LessonStepDto;
  readonly index: number;
  readonly attempt: number;
  readonly feedback: StepFeedback | null;
  readonly chosen: SceneChoice;
  readonly isSolved: boolean;
  readonly isUnclear: boolean;
  readonly isFinished: boolean;
  readonly isChecking: boolean;
  readonly errorCode: string | null;
  readonly mascot: MascotState;
  readonly beat: number;
  readonly log: readonly LogEntry[];
  /** Resolves to `true` when the backend answered, so the side panel knows to clear its draft. */
  readonly answer: (input: ChildInput) => Promise<boolean>;
  readonly next: () => void;
  readonly restart: () => void;
}

function choiceOf(input: ChildInput): SceneChoice {
  if (input.kind === 'choose') {
    return input.choice;
  }
  return input.kind === 'number' ? input.value : null;
}

function mascotOf(state: PlayerState, isChecking: boolean): MascotState {
  if (isChecking) {
    return 'thinking';
  }
  if (state.outcome === 'unclear') {
    return 'curious';
  }
  return state.isFinished ? 'cheer' : (state.feedback?.mascot ?? 'idle');
}

/**
 * Plays a lesson the backend judges: a tap or typed text is sent, and only the answer moves the
 * state. Correct waits for "next" on the step the backend named; a miss stays on the step with the
 * next try counted, so the backend can answer the second miss with its hint; unclear text is asked
 * again without counting. A failed request changes nothing but the message. Everything said is also
 * kept as a transcript for the side panel.
 */
export function useLessonPlayer(lesson: LessonDto, childProfileId: string): LessonPlayer {
  const lines = useLessonLines(lesson);
  const [state, setState] = useState(() => startState(lesson, lines));
  const [isChecking, startTransition] = useTransition();
  const step = lesson.steps[state.index];
  if (step === undefined) {
    throw new Error('A lesson step is missing.'); // authored lessons always have steps (catalog test)
  }

  const answer = (input: ChildInput) =>
    new Promise<boolean>((resolve) => {
      if (isChecking || state.outcome === 'correct') {
        resolve(false);
        return;
      }
      const said = input.kind === 'text' ? [{ who: 'child' as const, text: input.message }] : [];
      startTransition(async () => {
        const result = await checkSceneAnswerAction({
          childProfileId,
          lessonId: lesson.lessonId,
          stepId: step.id,
          attempt: state.attempt,
          answer: input,
        }).catch(() => null);
        if (!result?.ok) {
          setState({ ...state, errorCode: result?.error.code ?? REQUEST_FAILED_CODE });
          resolve(false);
          return;
        }
        const view = result.data;
        const reply =
          view.outcome === 'unclear' ? lines.unclear(step) : lines.feedback(step, view.feedback);
        setState({
          ...state,
          outcome: view.outcome,
          feedback: view.feedback,
          nextStepId: view.nextStepId,
          chosen: choiceOf(input),
          attempt: view.outcome === 'not_yet' ? state.attempt + 1 : state.attempt,
          errorCode: null,
          beat: state.beat + 1,
          log: append(state.log, ...said, { who: 'companion', text: reply }),
        });
        resolve(true);
      });
    });

  const next = () => {
    const index = lesson.steps.findIndex(({ id }) => id === state.nextStepId);
    const upcoming = lesson.steps[index];
    if (upcoming === undefined) {
      setState({
        ...state,
        isFinished: true,
        log: append(state.log, { who: 'companion', text: lines.conclusion() }),
      });
      return;
    }
    setState({
      ...startState(lesson, lines, state.beat),
      index,
      log: append(state.log, { who: 'companion', text: lines.narration(upcoming) }),
    });
  };

  return {
    step,
    index: state.index,
    attempt: state.attempt,
    feedback: state.feedback,
    chosen: state.chosen,
    isSolved: state.outcome === 'correct',
    isUnclear: state.outcome === 'unclear',
    isFinished: state.isFinished,
    isChecking,
    errorCode: state.errorCode,
    mascot: mascotOf(state, isChecking),
    beat: state.beat,
    log: state.log,
    answer,
    next,
    restart: () => {
      setState(startState(lesson, lines, state.beat + 1));
    },
  };
}
