'use client';

import type { TutorOption } from '@modules/learner/client';
import { learnerRoutes } from '@modules/learner/client';
import { ReadAloudButton } from '@modules/voice/client';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useHelpConversation } from '../hooks/use-help-conversation';
import { messageKeyForCode } from '../messages/message-keys';
import { guidanceRoutes } from '../routes';

import { ConversationLines } from './conversation-lines';
import { HelpDraftForm } from './help-draft-form';
import { LearningPauseNote } from './learning-pause-note';

import type { HelpSessionDto } from '../dto/guidance-dto';
import type { HelpConversationState } from '../hooks/use-help-conversation';

const REDIRECT_KEY = {
  small_talk: 'opening.redirect.small_talk',
  curiosity: 'opening.redirect.curiosity',
} as const;

interface HelpConversationProps {
  readonly childProfileId: string;
  readonly initial: HelpSessionDto;
  readonly companion: TutorOption;
  readonly voiceConsent?: boolean;
}

function StepStatus({
  state,
  companionName,
}: {
  readonly state: HelpConversationState;
  readonly companionName: string;
}) {
  const t = useTranslations('guidance');
  const { failure } = state;
  return (
    <>
      {state.isPending && (
        <p role="status" className="text-copy-muted">
          {t('conversation.thinking', { name: companionName })}
        </p>
      )}
      {failure?.pause ? <LearningPauseNote pause={failure.pause} /> : null}
      {failure !== null && failure.pause === null && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="font-semibold text-nudge">
            {failure.code === 'empty'
              ? t('conversation.empty')
              : t(
                  failure.code === null ? 'errors.infrastructure' : messageKeyForCode(failure.code),
                )}
          </p>
          {failure.code !== 'empty' && (
            <Button
              type="button"
              variant="outline"
              onClick={state.retry}
              disabled={state.isPending}
            >
              {t('conversation.retry')}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * The help session screen (#83, designer guide §10): one conversation, the task stays visible,
 * the chosen companion leads. What the child can do next follows the backend's phase only.
 */
export function HelpConversation({
  childProfileId,
  initial,
  companion,
  voiceConsent = false,
}: HelpConversationProps) {
  const t = useTranslations('guidance');
  const state = useHelpConversation(childProfileId, initial);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader className="items-start text-left">
          <h1 className="font-heading text-2xl">{t('conversation.taskTitle')}</h1>
        </CardHeader>
        <CardContent>
          <p className="text-lead whitespace-pre-wrap">{initial.task}</p>
        </CardContent>
      </Card>
      {initial.opening !== null && (
        <Card>
          <CardContent className="gap-4">
            <p className="font-semibold">{companion.name}</p>
            <p>
              {initial.opening.kind === 'clarify'
                ? t('opening.clarify')
                : t(REDIRECT_KEY[initial.opening.intent])}
            </p>
            <ReadAloudButton
              childProfileId={childProfileId}
              allowed={voiceConsent}
              message={{ kind: 'opening', sessionId: initial.sessionId }}
            />
            <Button asChild size="lg">
              <Link href={guidanceRoutes.start(childProfileId)}>{t('conversation.newTask')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <ConversationLines
        lines={state.lines}
        companion={companion}
        childProfileId={childProfileId}
        voiceConsent={voiceConsent}
      />
      <StepStatus state={state} companionName={companion.name} />
      {state.phase === 'working' && initial.opening === null && (
        <Card>
          <CardContent className="gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="lg" disabled={state.isPending} onClick={state.askForHint}>
                {t('conversation.hint')}
              </Button>
              {state.hintsUsed > 0 && (
                <span className="text-sm text-copy-muted">
                  {t('conversation.hintsUsed', { count: state.hintsUsed })}
                </span>
              )}
            </div>
            <HelpDraftForm
              state={state}
              kind="answer"
              childProfileId={childProfileId}
              voiceConsent={voiceConsent}
            />
          </CardContent>
        </Card>
      )}
      {state.phase === 'comprehension' && (
        <Card>
          <CardContent>
            <HelpDraftForm
              state={state}
              kind="reply"
              childProfileId={childProfileId}
              voiceConsent={voiceConsent}
            />
          </CardContent>
        </Card>
      )}
      {state.phase === 'understood' ? (
        <Card>
          <CardContent className="items-center gap-4 py-8 text-center">
            <h2 className="font-heading text-3xl">{t('conversation.doneTitle')}</h2>
            <p className="text-lead">{t('conversation.doneBody', { name: companion.name })}</p>
            <Button asChild size="lg">
              <Link href={learnerRoutes.home()}>{t('conversation.home')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button asChild variant="ghost">
          <Link href={learnerRoutes.home()}>{t('conversation.later')}</Link>
        </Button>
      )}
    </div>
  );
}
