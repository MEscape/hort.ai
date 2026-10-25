'use client';

import { useRef, useState, type ChangeEvent, type Ref, type SubmitEvent } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Lightbulb } from '@components/ui/icons';
import { Label } from '@components/ui/label';

import { useTranslations } from '@i18n/client';

import { isBlank } from '@lib/utils';

const TASK_CHARACTER_LIMIT = 1000;

interface TaskEntryProps {
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly headingRef: Ref<HTMLHeadingElement>;
}

// @ui-plain textarea No shared Textarea primitive is installed yet.
// @unsaved-work none This frontend-only draft is never submitted or persisted.
export function TaskEntry({ draft, onDraftChange, headingRef }: TaskEntryProps) {
  const t = useTranslations('app');
  const [status, setStatus] = useState<'editing' | 'invalid' | 'unavailable'>('editing');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBlank(draft)) {
      setStatus('invalid');
      inputRef.current?.focus();
      return;
    }
    // Issue #12: replace this local notice with the authenticated session-creation Server Action.
    setStatus('unavailable');
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onDraftChange(event.currentTarget.value);
    setStatus('editing');
  }

  function handleClear() {
    onDraftChange('');
    setStatus('editing');
    inputRef.current?.focus();
  }

  return (
    <Card>
      <CardHeader className="items-start text-left">
        <h1 ref={headingRef} tabIndex={-1} className="font-heading text-3xl text-copy sm:text-4xl">
          {t('start.entry.title')}
        </h1>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Label
            htmlFor="homework-task"
            className="block font-heading text-xl font-semibold text-copy"
          >
            {t('start.entry.label')}
          </Label>
          <textarea
            ref={inputRef}
            id="homework-task"
            rows={5}
            maxLength={TASK_CHARACTER_LIMIT}
            value={draft}
            onChange={handleChange}
            placeholder={t('start.entry.placeholder')}
            aria-invalid={status === 'invalid'}
            aria-describedby={status === 'invalid' ? 'task-note task-error' : 'task-note'}
            autoComplete="off"
            className="block min-h-48 w-full resize-y rounded-token-lg border-2 border-border-strong bg-surface p-4 text-lead text-copy placeholder:text-copy-muted"
          />
          <p id="task-note" className="text-sm text-copy-muted">
            {t('start.entry.note', { limit: TASK_CHARACTER_LIMIT })}
          </p>
          {status === 'invalid' && (
            <p id="task-error" role="alert" className="font-semibold text-nudge">
              {t('start.entry.empty')}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg">
              {t('start.entry.review')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={draft.length === 0}
            >
              {t('start.entry.clear')}
            </Button>
          </div>
          {status === 'unavailable' && (
            <Alert variant="hint" role="status">
              <Lightbulb aria-hidden="true" />
              <AlertTitle>{t('start.entry.unavailableTitle')}</AlertTitle>
              <AlertDescription>{t('start.entry.unavailableBody')}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
