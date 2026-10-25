'use client';

import { BuildBridge } from './build-bridge';
import { CompareBridges } from './compare-bridges';
import { Groups } from './groups';
import { NumberLine } from './number-line';

import type {
  CompareChoice,
  Scene,
  SceneAnswer,
  SceneReaction,
} from '../../application/contracts/lesson-constraints';

/** What the child last picked on a scene: a bridge, or a number. */
export type SceneChoice = CompareChoice | number | null;

export interface SceneViewProps {
  readonly scene: Scene;
  readonly reaction: SceneReaction | null;
  readonly chosen: SceneChoice;
  readonly attempt: number;
  readonly isSolved: boolean;
  readonly disabled: boolean;
  readonly onAnswer: (answer: SceneAnswer) => void;
}

const asNumber = (chosen: SceneChoice) => (typeof chosen === 'number' ? chosen : null);
const asBridge = (chosen: SceneChoice) => (typeof chosen === 'string' ? chosen : null);

/**
 * Draws a scene with its approved template, for an authored step and a planned task scene alike.
 * The union is closed: a template the client does not know cannot reach here.
 */
export function SceneView({
  scene,
  reaction,
  chosen,
  attempt,
  isSolved,
  disabled,
  onAnswer,
}: SceneViewProps) {
  const chooseNumber = (value: number) => {
    onAnswer({ kind: 'number', value });
  };
  switch (scene.template) {
    case 'compare-bridges':
      return (
        <CompareBridges
          scene={scene}
          reaction={reaction}
          chosen={asBridge(chosen)}
          attempt={attempt}
          isSolved={isSolved}
          disabled={disabled}
          onChoose={(choice) => {
            onAnswer({ kind: 'choose', choice });
          }}
        />
      );
    case 'build-bridge':
      return (
        <BuildBridge
          scene={scene}
          reaction={reaction}
          attempt={attempt}
          disabled={disabled}
          onSubmit={(laid) => {
            onAnswer({ kind: 'fill', laid });
          }}
        />
      );
    case 'number-line':
      return (
        <NumberLine
          scene={scene}
          reaction={reaction}
          chosen={asNumber(chosen)}
          attempt={attempt}
          isSolved={isSolved}
          disabled={disabled}
          onChoose={chooseNumber}
        />
      );
    case 'groups':
      return (
        <Groups
          scene={scene}
          reaction={reaction}
          chosen={asNumber(chosen)}
          attempt={attempt}
          isSolved={isSolved}
          disabled={disabled}
          onChoose={chooseNumber}
        />
      );
  }
}
