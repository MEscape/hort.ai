'use client';

import { useState, useTransition } from 'react';

import type { ActionResult } from '@lib/result';

import { REQUEST_FAILED_CODE } from '../messages/message-keys';

import type {
  ChildInput,
  Outcome,
  StepFeedback,
} from '../../application/contracts/lesson-constraints';
import type { SceneChoice } from '../components/scene-view';
import type { SceneAnswerDto } from '../dto/lesson-dto';

interface TaskSceneState {
  readonly attempt: number;
  readonly outcome: Outcome | 'unclear' | null;
  readonly feedback: StepFeedback | null;
  readonly chosen: SceneChoice;
  readonly errorCode: string | null;
  readonly beat: number;
}

const START: TaskSceneState = {
  attempt: 1,
  outcome: null,
  feedback: null,
  chosen: null,
  errorCode: null,
  beat: 0,
};

/** Sends one answer to the backend that judges this scene: a task's example, a place's practice, ... */
export type SceneCheck = (
  attempt: number,
  answer: ChildInput,
) => Promise<ActionResult<SceneAnswerDto>>;

export interface ScenePlayer extends TaskSceneState {
  readonly isChecking: boolean;
  readonly answer: (input: ChildInput) => void;
}

function choiceOf(input: ChildInput): SceneChoice {
  if (input.kind === 'choose') {
    return input.choice;
  }
  return input.kind === 'number' ? input.value : null;
}

/**
 * One scene judged by the backend like a lesson step: a miss counts the try (the second brings the
 * hint), unclear text does not, a failed request changes nothing but the message.
 */
export function useSceneCheck(check: SceneCheck): ScenePlayer {
  const [state, setState] = useState(START);
  const [isChecking, startTransition] = useTransition();

  const answer = (input: ChildInput) => {
    if (isChecking || state.outcome === 'correct') {
      return;
    }
    startTransition(async () => {
      const result = await check(state.attempt, input).catch(() => null);
      if (!result?.ok) {
        setState({ ...state, errorCode: result?.error.code ?? REQUEST_FAILED_CODE });
        return;
      }
      const { outcome, feedback } = result.data;
      setState({
        outcome,
        feedback,
        chosen: choiceOf(input),
        attempt: outcome === 'not_yet' ? state.attempt + 1 : state.attempt,
        errorCode: null,
        beat: state.beat + 1,
      });
    });
  };

  return { ...state, isChecking, answer };
}
