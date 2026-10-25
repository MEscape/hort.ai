'use client';

import { FormAlert } from '@components/shared/form-alert';

import { useTranslations } from '@i18n/client';

import { useSceneCheck } from '../hooks/use-scene-check';
import { messageKeyForCode } from '../messages/message-keys';

import { RewardBurst } from './reward-burst';
import { SceneView } from './scene-view';

import type { Scene } from '../../application/contracts/lesson-constraints';
import type { TaskSceneKind } from '../dto/lesson-dto';
import type { SceneCheck } from '../hooks/use-scene-check';

export type { SceneCheck } from '../hooks/use-scene-check';

/** The numbers a scene's sentences are filled with. */
function sceneValues(scene: Scene): Record<string, string | number> {
  switch (scene.template) {
    case 'number-line':
      return {
        start: scene.start,
        steps: Math.abs(scene.jump),
        sign: scene.jump < 0 ? 'minus' : 'plus',
        landing: scene.start + scene.jump,
      };
    case 'groups':
      return { groups: scene.groups, each: scene.each, total: scene.groups * scene.each };
    case 'build-bridge':
      return { numerator: scene.target.numerator, denominator: scene.target.denominator };
    case 'compare-bridges':
      return {};
  }
}

const FEEDBACK_LINES = ['correct', 'notYet', 'hint'] as const;

/** A planned scene's feedback names one of these lines; anything else shows the narration. */
const lineOf = (line: string | undefined) =>
  FEEDBACK_LINES.find((known) => known === line) ?? 'narration';

export interface SceneCardProps {
  /** The scene's text family (`lesson.scenes.<kind>`). */
  readonly kind: TaskSceneKind;
  readonly scene: Scene;
  /** What the card is, above the scene ("An example like your task"). */
  readonly label: string;
  readonly check: SceneCheck;
}

/**
 * A planned scene to try on the canvas, judged by the backend through `check`: a homework task's
 * example, a place's practice round. One sentence says what to do or how it went; the label says
 * what the card is. The card never decides anything itself.
 */
export function SceneCard({ kind, scene, label, check }: SceneCardProps) {
  const t = useTranslations('lesson');
  const player = useSceneCheck(check);
  const line =
    player.outcome === 'unclear'
      ? t(`stage.unclear.${scene.template}`)
      : t(`scenes.${kind}.${lineOf(player.feedback?.line)}`, sceneValues(scene));

  return (
    <section
      aria-label={label}
      className="relative flex w-full flex-col items-center gap-4 rounded-token-xl bg-surface/60 p-4"
    >
      <p className="text-sm font-semibold text-copy-muted">{label}</p>
      <p aria-live="polite" className="measure text-center text-lead text-copy">
        {player.isChecking ? '…' : line}
      </p>
      <SceneView
        scene={scene}
        reaction={player.feedback?.reaction ?? null}
        chosen={player.chosen}
        attempt={player.attempt}
        isSolved={player.outcome === 'correct'}
        disabled={player.isChecking || player.outcome === 'correct'}
        onAnswer={player.answer}
      />
      <FormAlert
        id="task-scene-error"
        message={player.errorCode === null ? undefined : t(messageKeyForCode(player.errorCode))}
      />
      {player.feedback?.reaction === 'celebrate' ? <RewardBurst key={player.beat} /> : null}
    </section>
  );
}
