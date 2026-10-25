'use client';

import { VoiceInputButton } from '@modules/voice/client';

import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';

import { useTranslations } from '@i18n/client';

import type { HelpConversationState } from '../hooks/use-help-conversation';

const DRAFT_MAX_LENGTH = 1000;

/** The child's editable answer or comprehension reply; dictation never submits the form. */
export function HelpDraftForm({
  state,
  kind,
  childProfileId,
  voiceConsent,
}: {
  readonly state: HelpConversationState;
  readonly kind: 'answer' | 'reply';
  readonly childProfileId: string;
  readonly voiceConsent: boolean;
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
      <VoiceInputButton
        childProfileId={childProfileId}
        allowed={voiceConsent}
        onTranscript={state.setDraft}
      />
      <Button type="submit" size="lg" disabled={state.isPending}>
        {t(kind === 'answer' ? 'conversation.checkAnswer' : 'conversation.sendReply')}
      </Button>
    </form>
  );
}
