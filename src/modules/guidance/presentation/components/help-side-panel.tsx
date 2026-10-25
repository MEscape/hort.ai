'use client';

import { SidePanelFrame } from '@components/shared/side-panel';

import { useTranslations } from '@i18n/client';

import { ConversationTranscript } from './conversation-lines';
import { HelpDraftForm } from './help-draft-form';
import { StepStatus } from './step-status';

import type { HelpConversationState } from '../hooks/use-help-conversation';

interface HelpSidePanelProps {
  readonly state: HelpConversationState;
  readonly companionName: string;
  readonly childProfileId: string;
  /** What the parent stored: read aloud and dictation only with it. */
  readonly voiceConsent: boolean;
  /** The session opened with a fixed question or redirect: nothing to answer here. */
  readonly hasOpening: boolean;
  readonly onClose: () => void;
}

/**
 * The help session's side panel: the whole conversation as text (each companion line can be read
 * aloud) and the child's own answer to the task or reply to the comprehension question, typed or
 * dictated. The own task is answered here, so the panel starts open.
 */
export function HelpSidePanel({
  state,
  companionName,
  childProfileId,
  voiceConsent,
  hasOpening,
  onClose,
}: HelpSidePanelProps) {
  const t = useTranslations('guidance');
  return (
    <SidePanelFrame
      title={t('conversation.panelTitle', { name: companionName })}
      closeLabel={t('conversation.close')}
      onClose={onClose}
      scrollKey={state.lines.length}
      transcript={
        <ConversationTranscript
          lines={state.lines}
          companionName={companionName}
          childProfileId={childProfileId}
          voiceConsent={voiceConsent}
        />
      }
      footer={
        <div className="flex flex-col gap-3">
          <StepStatus state={state} companionName={companionName} />
          {(state.phase === 'comprehension' || (state.phase === 'working' && !hasOpening)) && (
            <HelpDraftForm
              state={state}
              kind={state.phase === 'comprehension' ? 'reply' : 'answer'}
              childProfileId={childProfileId}
              voiceConsent={voiceConsent}
            />
          )}
        </div>
      }
    />
  );
}
