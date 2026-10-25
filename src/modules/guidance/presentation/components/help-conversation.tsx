'use client';

import type { TutorOption } from '@modules/learner/client';
import { learnerRoutes } from '@modules/learner/client';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Label } from '@components/ui/label';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useHelpConversation } from '../hooks/use-help-conversation';
import { isChildDistressCode, messageKeyForCode } from '../messages/message-keys';
import { guidanceRoutes } from '../routes';

import { ConversationLines } from './conversation-lines';
import { DistressHelp } from './distress-help';

import type { HelpSessionDto } from '../dto/guidance-dto';
import type { HelpConversationState } from '../hooks/use-help-conversation';

const DRAFT_MAX_LENGTH = 1000;
const REDIRECT_KEY = {
  small_talk: 'opening.redirect.small_talk',
  curiosity: 'opening.redirect.curiosity',
} as const;

interface HelpConversationProps {
  readonly childProfileId: string;
  readonly initial: HelpSessionDto;
  readonly companion: TutorOption;
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
      {failure !== null && (
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

function DraftForm({
  state,
  kind,
}: {
  readonly state: HelpConversationState;
  readonly kind: 'answer' | 'reply';
}) {
  const t = useTranslations('guidance');
  const id = `help-${kind}`;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (kind === 'answer') {
          state.submitAnswer();
        } else {
          state.submitReply();
        }
      }}
    >
      <Label htmlFor={id} className="block font-heading text-xl font-semibold">
        {t(kind === 'answer' ? 'conversation.answerLabel' : 'conversation.replyLabel')}
      </Label>
      {/* @ui-plain textarea The shared UI package has no textarea primitive yet. */}
      <textarea
        id={id}
        value={state.draft}
        onChange={(event) => {
          state.setDraft(event.currentTarget.value);
        }}
        maxLength={DRAFT_MAX_LENGTH}
        rows={3}
        autoComplete="off"
        className="block min-h-28 w-full rounded-token-lg border-2 border-border-strong bg-surface p-3 text-lead text-copy"
      />
      <Button type="submit" size="lg" disabled={state.isPending}>
        {t(kind === 'answer' ? 'conversation.checkAnswer' : 'conversation.sendReply')}
      </Button>
    </form>
  );
}

/**
 * The help session screen (#83, designer guide §10): one conversation, the task stays visible,
 * the chosen companion leads. What the child can do next follows the backend's phase only.
 */
export function HelpConversation({ childProfileId, initial, companion }: HelpConversationProps) {
  const t = useTranslations('guidance');
  const state = useHelpConversation(childProfileId, initial);
  if (
    state.failure?.code !== null &&
    state.failure?.code !== undefined &&
    isChildDistressCode(state.failure.code)
  ) {
    return <DistressHelp />;
  }
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
            <Button asChild size="lg">
              <Link href={guidanceRoutes.start(childProfileId)}>{t('conversation.newTask')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <ConversationLines lines={state.lines} companion={companion} />
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
            <DraftForm state={state} kind="answer" />
          </CardContent>
        </Card>
      )}
      {state.phase === 'comprehension' && (
        <Card>
          <CardContent>
            <DraftForm state={state} kind="reply" />
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
