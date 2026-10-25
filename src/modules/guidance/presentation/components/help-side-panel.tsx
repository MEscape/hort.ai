'use client';

import { SidePanelFrame } from '@components/shared/side-panel';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';

import { useTranslations } from '@i18n/client';

import { ConversationTranscript } from './conversation-lines';
import { StepStatus } from './step-status';

import type { HelpConversationState } from '../hooks/use-help-conversation';

const DRAFT_MAX_LENGTH = 1000;

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
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (kind === 'answer') {
          state.submitAnswer();
        } else {
          state.submitReply();
        }
      }}
    >
      <Label htmlFor={id} className="font-heading text-lg font-semibold">
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
        rows={2}
        autoComplete="off"
        className="block w-full rounded-token-lg border-2 border-border-strong bg-surface p-3 text-lead text-copy"
      />
      <Button type="submit" size="lg" disabled={state.isPending}>
        {t(kind === 'answer' ? 'conversation.checkAnswer' : 'conversation.sendReply')}
      </Button>
    </form>
  );
}

interface HelpSidePanelProps {
  readonly state: HelpConversationState;
  readonly companionName: string;
  /** The session opened with a fixed question or redirect: nothing to answer here. */
  readonly hasOpening: boolean;
  readonly onClose: () => void;
}

/**
 * The help session's side panel: the whole conversation as text and the child's own answer to the
 * task (or the reply to the comprehension question). Until the child can speak, writing is how the
 * own task is answered, so the panel starts open here.
 */
export function HelpSidePanel({ state, companionName, hasOpening, onClose }: HelpSidePanelProps) {
  const t = useTranslations('guidance');
  return (
    <SidePanelFrame
      title={t('conversation.panelTitle', { name: companionName })}
      closeLabel={t('conversation.close')}
      onClose={onClose}
      scrollKey={state.lines.length}
      transcript={<ConversationTranscript lines={state.lines} companionName={companionName} />}
      footer={
        <div className="flex flex-col gap-3">
          <StepStatus state={state} companionName={companionName} />
          {state.phase === 'working' && !hasOpening && <DraftForm state={state} kind="answer" />}
          {state.phase === 'comprehension' && <DraftForm state={state} kind="reply" />}
        </div>
      }
    />
  );
}
