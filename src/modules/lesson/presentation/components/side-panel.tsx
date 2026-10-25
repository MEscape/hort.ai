'use client';

import { useState } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { SidePanelFrame, TranscriptLine } from '@components/shared/side-panel';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

import { useTranslations } from '@i18n/client';

import { isBlank } from '@lib/utils';

import { TEXT_ANSWER_MAX_LENGTH } from '../../application/contracts/lesson-constraints';

import type { LogEntry } from '../hooks/use-lesson-player';

export interface SidePanelProps {
  readonly companionName: string;
  readonly log: readonly LogEntry[];
  /** What to write here, for this step's template. */
  readonly hint: string;
  readonly disabled: boolean;
  /** Why the last send failed (also the trusted-adult notice), next to the field it came from. */
  readonly errorText: string | undefined;
  /** Resolves `true` when the backend answered; only then the draft is cleared. */
  readonly onSend: (message: string) => Promise<boolean>;
  readonly onClose: () => void;
}

/**
 * The lesson's side panel: everything the companion said as text, and a field to answer by writing
 * instead of tapping. The text goes to the same backend check as a tap, which reads it by fixed
 * rules. A failed or refused send keeps the draft.
 */
export function SidePanel({
  companionName,
  log,
  hint,
  disabled,
  errorText,
  onSend,
  onClose,
}: SidePanelProps) {
  const t = useTranslations('lesson');
  const [draft, setDraft] = useState('');

  return (
    <SidePanelFrame
      title={t('side.title', { name: companionName })}
      closeLabel={t('side.close')}
      onClose={onClose}
      scrollKey={log.length}
      transcript={log.map((entry) => (
        <TranscriptLine
          key={entry.id}
          who={entry.who}
          speaker={entry.who === 'child' ? t('side.you') : companionName}
          text={entry.text}
        />
      ))}
      footer={
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const message = draft.trim();
            if (message !== '') {
              void onSend(message).then((answered) => {
                if (answered) {
                  setDraft('');
                }
              });
            }
          }}
        >
          <FormAlert id="lesson-side-error" message={errorText} />
          <Label htmlFor="lesson-side-input">{t('side.input')}</Label>
          <p id="lesson-side-hint" className="text-sm text-copy-muted">
            {hint}
          </p>
          <div className="flex gap-2">
            <Input
              id="lesson-side-input"
              value={draft}
              maxLength={TEXT_ANSWER_MAX_LENGTH}
              autoComplete="off"
              aria-describedby="lesson-side-hint"
              disabled={disabled}
              onChange={(event) => {
                setDraft(event.currentTarget.value);
              }}
            />
            <Button type="submit" disabled={disabled || isBlank(draft)}>
              {t('side.send')}
            </Button>
          </div>
        </form>
      }
    />
  );
}
