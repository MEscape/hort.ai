'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import type { TutorOption } from '@modules/learner/client';
import { learnerRoutes } from '@modules/learner/client';

import { Stage } from '@components/shared/stage';
import { StageCompanion } from '@components/shared/stage-companion';
import type { MascotState } from '@components/shared/stage-companion';
import { Button } from '@components/ui/button';
import { Lightbulb, Pencil, Plus } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useHelpConversation } from '../hooks/use-help-conversation';
import { guidanceRoutes } from '../routes';

import { companionText } from './conversation-lines';
import { HelpSidePanel } from './help-side-panel';

import type { HelpSessionDto } from '../dto/guidance-dto';
import type { HelpConversationState } from '../hooks/use-help-conversation';

const REDIRECT_KEY = {
  small_talk: 'opening.redirect.small_talk',
  curiosity: 'opening.redirect.curiosity',
} as const;
const PHASES = ['working', 'comprehension', 'understood'] as const;

interface HelpConversationProps {
  readonly childProfileId: string;
  readonly initial: HelpSessionDto;
  readonly companion: TutorOption;
  /** The canvas for the task (a similar example to try), drawn by the page; `null` when none fits. */
  readonly scene?: ReactNode;
}

/** The one sentence on the stage: thinking, done, the opening, or what the companion said last. */
function useLine(state: HelpConversationState, initial: HelpSessionDto, name: string): string {
  const t = useTranslations('guidance');
  const said = state.lines.filter((line) => line.kind !== 'child').at(-1);
  if (state.isPending) {
    return t('conversation.thinking', { name });
  }
  if (state.phase === 'understood') {
    return t('conversation.doneBody', { name });
  }
  if (initial.opening !== null) {
    return initial.opening.kind === 'clarify'
      ? t('opening.clarify')
      : t(REDIRECT_KEY[initial.opening.intent]);
  }
  return said === undefined ? '' : companionText(said, t);
}

function mascotOf(state: HelpConversationState): MascotState {
  const last = state.lines.at(-1);
  if (state.isPending) {
    return 'thinking';
  }
  if (state.phase === 'understood') {
    return 'cheer';
  }
  if (last?.kind === 'feedback') {
    return last.result === null ? 'cheer' : 'oops';
  }
  return last?.kind === 'hint' ? 'curious' : 'idle';
}

function StageAction({
  state,
  initial,
}: {
  readonly state: HelpConversationState;
  readonly initial: HelpSessionDto;
}) {
  const t = useTranslations('guidance');
  if (state.phase === 'understood') {
    return (
      <Button asChild size="lg" variant="accent">
        <Link href={learnerRoutes.home()}>{t('conversation.home')}</Link>
      </Button>
    );
  }
  if (initial.opening !== null) {
    return (
      <Button asChild size="lg">
        <Link href={guidanceRoutes.newTask()}>{t('conversation.newTask')}</Link>
      </Button>
    );
  }
  return state.phase === 'working' ? (
    <Button
      type="button"
      size="lg"
      variant="accent"
      disabled={state.isPending}
      onClick={state.askForHint}
    >
      <Lightbulb aria-hidden />
      {t('conversation.hint')}
    </Button>
  ) : null;
}

/**
 * The help session on the canvas stage (R-021): the child's task and a similar example to try in
 * the middle, the companion with one sentence (the latest hint or feedback) at the bottom, the hint
 * as the main action, and the conversation with the answer field in the side panel. What the child
 * can do next follows the backend's phase only; nothing here decides anything.
 */
export function HelpConversation({
  childProfileId,
  initial,
  companion,
  scene = null,
}: HelpConversationProps) {
  const t = useTranslations('guidance');
  const state = useHelpConversation(childProfileId, initial);
  const line = useLine(state, initial, companion.name);
  const [isPanelOpen, setPanelOpen] = useState(true);
  const current = PHASES.indexOf(state.phase) + 1;

  return (
    <Stage
      title={t('conversation.taskTitle')}
      current={current}
      total={PHASES.length}
      progressLabel={t('conversation.progress', { current, total: PHASES.length })}
      companion={
        <StageCompanion companion={companion} mascot={mascotOf(state)} beat={state.lines.length} />
      }
      line={line}
      action={<StageAction state={state} initial={initial} />}
      tools={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href={guidanceRoutes.newTask()}>
              <Plus aria-hidden />
              {t('conversation.newTask')}
            </Link>
          </Button>
          <Button
            variant={isPanelOpen ? 'secondary' : 'outline'}
            size="sm"
            aria-expanded={isPanelOpen}
            onClick={() => {
              setPanelOpen(!isPanelOpen);
            }}
          >
            <Pencil aria-hidden />
            {t('conversation.panelOpen')}
          </Button>
        </>
      }
      side={
        isPanelOpen ? (
          <HelpSidePanel
            state={state}
            companionName={companion.name}
            hasOpening={initial.opening !== null}
            onClose={() => {
              setPanelOpen(false);
            }}
          />
        ) : null
      }
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-4">
        <p className="w-full rounded-token-xl bg-surface p-4 text-lead whitespace-pre-wrap text-copy shadow-soft">
          {initial.task}
        </p>
        {initial.opening === null && state.phase !== 'understood' ? scene : null}
      </div>
    </Stage>
  );
}
