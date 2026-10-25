'use client';

import { useEffect, useState } from 'react';

import { learnerRoutes } from '@modules/learner/client';

import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { messageKeyForCode } from '../messages/message-keys';

import { LearningPauseNote } from './learning-pause-note';

import type { HelpConversationState, StepFailure } from '../hooks/use-help-conversation';

const MS_PER_SECOND = 1000;

/** Codes a retry cannot fix: the child gets the message and a way home, never an endless Retry. */
const FINAL_CODES: ReadonlySet<string> = new Set([
  'guidance.session_not_found',
  'guidance.no_open_question',
  'guidance.no_hint_for_opening',
  'guidance.child_distress',
]);

/** Whether Retry is held back: while the budget's `retryAfterSeconds` run. No countdown is shown. */
function useCoolingDown(failure: StepFailure | null): boolean {
  const [cooledFor, setCooledFor] = useState<StepFailure | null>(null);
  const seconds = failure?.retryAfterSeconds ?? null;
  useEffect(() => {
    if (seconds === null) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setCooledFor(failure);
    }, seconds * MS_PER_SECOND);
    return () => {
      window.clearTimeout(timer);
    };
  }, [failure, seconds]);
  return seconds !== null && cooledFor !== failure;
}

function messageOf(code: string | null) {
  if (code === 'empty') {
    return 'conversation.empty';
  }
  return code === null ? 'errors.infrastructure' : messageKeyForCode(code);
}

/** The distress notice or a gone session: the message and a calm way home. */
function FinalNotice({ code }: { readonly code: string }) {
  const t = useTranslations('guidance');
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-token-lg border-2 border-hint-border bg-hint-subtle p-4 text-copy"
    >
      <p className="text-lead font-semibold">{t(messageOf(code))}</p>
      <Button asChild size="lg" variant="outline" className="self-start">
        <Link href={learnerRoutes.home()}>{t('conversation.home')}</Link>
      </Button>
    </div>
  );
}

/** What the last step is doing or why it failed, with Retry only where a retry can help. */
export function StepStatus({
  state,
  companionName,
}: {
  readonly state: HelpConversationState;
  readonly companionName: string;
}) {
  const t = useTranslations('guidance');
  const { failure } = state;
  const isCooling = useCoolingDown(failure);
  const code = failure?.code ?? null;
  return (
    <>
      {state.isPending && (
        <p role="status" className="text-copy-muted">
          {t('conversation.thinking', { name: companionName })}
        </p>
      )}
      {/* A closed window or a used-up day (#88) is calm news with the time it opens: no retry. */}
      {failure?.pause ? <LearningPauseNote pause={failure.pause} /> : null}
      {failure !== null && failure.pause === null && code !== null && FINAL_CODES.has(code) && (
        <FinalNotice code={code} />
      )}
      {failure !== null && failure.pause === null && !(code !== null && FINAL_CODES.has(code)) && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="font-semibold text-nudge">{t(messageOf(code))}</p>
          {code !== 'empty' && (
            <Button
              type="button"
              variant="outline"
              onClick={state.retry}
              disabled={state.isPending || isCooling}
            >
              {t('conversation.retry')}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
