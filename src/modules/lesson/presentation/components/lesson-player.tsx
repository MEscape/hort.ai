'use client';

import { useState } from 'react';

import type { TutorOption } from '@modules/learner/client';

import { FormAlert } from '@components/shared/form-alert';
import { Stage } from '@components/shared/stage';
import { StageCompanion } from '@components/shared/stage-companion';
import { Button } from '@components/ui/button';
import { ArrowRight, Pencil, RotateCcw } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useLessonPlayer } from '../hooks/use-lesson-player';
import { lessonLineKey, messageKeyForCode } from '../messages/message-keys';

import { RewardBurst } from './reward-burst';
import { SceneView } from './scene-view';
import { SidePanel } from './side-panel';

import type { LessonDto } from '../dto/lesson-dto';
import type { LessonPlayer as Player } from '../hooks/use-lesson-player';

export interface LessonPlayerProps {
  readonly childProfileId: string;
  readonly lesson: LessonDto;
  readonly companion: TutorOption;
}

/** The sentence on screen: thinking, or the last thing the companion said (narration, feedback, conclusion). */
function useLine(player: Player, companionName: string): string {
  const t = useTranslations('lesson');
  const said = player.log.filter((entry) => entry.who === 'companion').at(-1);
  return player.isChecking ? t('stage.checking', { name: companionName }) : (said?.text ?? '');
}

/**
 * The side panel and its toggle: closed at first, opened by the child (or a grown-up) to write.
 * A failure shows where the child acted: in the open panel, otherwise under the scene.
 */
function useSide(player: Player, companionName: string) {
  const t = useTranslations('lesson');
  const [isOpen, setOpen] = useState(false);
  const errorText = player.errorCode === null ? undefined : t(messageKeyForCode(player.errorCode));
  const toggle = (
    <Button
      variant={isOpen ? 'secondary' : 'outline'}
      size="sm"
      aria-expanded={isOpen}
      onClick={() => {
        setOpen(!isOpen);
      }}
    >
      <Pencil aria-hidden />
      {t('side.open')}
    </Button>
  );
  const panel = isOpen ? (
    <SidePanel
      companionName={companionName}
      log={player.log}
      hint={t(
        player.step.scene.template === 'build-bridge' ? 'side.hintBuild' : 'side.hintCompare',
      )}
      disabled={player.isChecking || player.isSolved || player.isFinished}
      errorText={errorText}
      onSend={(message) => player.answer({ kind: 'text', message })}
      onClose={() => {
        setOpen(false);
      }}
    />
  ) : null;
  return { toggle, panel, stageError: isOpen ? undefined : errorText };
}

function NextButton({ player }: { readonly player: Player }) {
  const t = useTranslations('lesson');
  if (player.isFinished) {
    return (
      <Button size="lg" variant="outline" onClick={player.restart}>
        <RotateCcw aria-hidden />
        {t('stage.again')}
      </Button>
    );
  }
  return player.isSolved ? (
    <Button size="lg" variant="accent" onClick={player.next}>
      {t('stage.next')}
      <ArrowRight aria-hidden />
    </Button>
  ) : null;
}

/**
 * A canvas-first lesson: the scene carries the explanation, the child answers by acting on it, the
 * companion reacts, and one sentence says what is going on. Writing is the optional side panel,
 * judged by the same backend check as a tap.
 */
export function LessonPlayer({ childProfileId, lesson, companion }: LessonPlayerProps) {
  const t = useTranslations('lesson');
  const player = useLessonPlayer(lesson, childProfileId);
  const line = useLine(player, companion.name);
  const side = useSide(player, companion.name);
  const reaction = player.feedback?.reaction ?? null;

  return (
    <Stage
      title={t(lessonLineKey(lesson.lessonId, 'title'))}
      current={player.isFinished ? lesson.steps.length + 1 : player.index + 1}
      total={lesson.steps.length}
      progressLabel={t('stage.progress', {
        current: Math.min(player.index + 1, lesson.steps.length),
        total: lesson.steps.length,
      })}
      companion={<StageCompanion companion={companion} mascot={player.mascot} beat={player.beat} />}
      line={line}
      action={<NextButton player={player} />}
      tools={side.toggle}
      side={side.panel}
      reward={
        reaction === 'celebrate' || player.isFinished ? <RewardBurst key={player.beat} /> : null
      }
    >
      {player.isFinished ? (
        <p className="font-heading text-4xl font-semibold text-copy">{t('stage.finishTitle')}</p>
      ) : (
        <div className="flex w-full flex-col items-center gap-3">
          <SceneView
            key={player.step.id}
            scene={player.step.scene}
            reaction={reaction}
            chosen={player.chosen}
            attempt={player.attempt}
            isSolved={player.isSolved}
            disabled={player.isChecking || player.isSolved}
            onAnswer={(answer) => {
              void player.answer(answer);
            }}
          />
          <FormAlert id="lesson-error" message={side.stageError} />
        </div>
      )}
    </Stage>
  );
}
