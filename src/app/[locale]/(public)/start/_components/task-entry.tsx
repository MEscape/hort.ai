'use client';

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type Ref,
  type SubmitEvent,
} from 'react';

import {
  LearningPauseNote,
  learningPauseOf,
  startHelpSessionAction,
} from '@modules/guidance/client';
import type { LearningPause } from '@modules/guidance/client';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Lightbulb } from '@components/ui/icons';
import { Label } from '@components/ui/label';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { isBlank } from '@lib/utils';

const TASK_CHARACTER_LIMIT = 1000;
/** The MVP helps with maths only (docs/product/mvp-scope.md). */
const MVP_SUBJECT = 'math';

interface TaskEntryProps {
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly childProfileId: string | null;
}

// @ui-plain textarea No shared Textarea primitive is installed yet.
// @unsaved-work none This transient task is submitted directly to start a session.
export function TaskEntry({ draft, onDraftChange, headingRef, childProfileId }: TaskEntryProps) {
  const t = useTranslations('app');
  const router = useRouter();
  const [status, setStatus] = useState<'editing' | 'invalid' | 'unavailable' | 'failed'>('editing');
  const [pause, setPause] = useState<LearningPause | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBlank(draft)) {
      setStatus('invalid');
      inputRef.current?.focus();
      return;
    }
    if (childProfileId === null) {
      setStatus('unavailable');
      return;
    }
    setStatus('editing');
    setPause(null);
    startTransition(async () => {
      const result = await startHelpSessionAction({
        childProfileId,
        task: draft,
        subject: MVP_SUBJECT,
      }).catch(() => null);
      if (result?.ok) {
        router.push('/help');
      } else {
        const learningPause = learningPauseOf(result?.error);
        setPause(learningPause);
        setStatus(learningPause === null ? 'failed' : 'editing');
      }
    });
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
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? t('start.entry.sending') : t('start.entry.review')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={draft.length === 0 || isPending}
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
          {pause !== null && <LearningPauseNote pause={pause} />}
          {status === 'failed' && (
            <p role="alert" className="text-nudge">
              {t('start.entry.failed')}
            </p>
          )}
          {isPending && (
            <p role="status" aria-live="polite">
              {t('start.entry.sending')}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
