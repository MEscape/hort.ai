'use client';

import { useRef, useState, useTransition, type ChangeEvent, type SubmitEvent } from 'react';

import {
  LearningPauseNote,
  learningPauseOf,
  startHelpSessionAction,
} from '@modules/guidance/client';
import type { LearningPause } from '@modules/guidance/client';
import { VoiceInputButton } from '@modules/voice/client';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Lightbulb } from '@components/ui/icons';
import { Label } from '@components/ui/label';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { isBlank } from '@lib/utils';

import { ReplaceOpenTask } from './replace-open-task';

import type { OpenTask } from './replace-open-task';

const TASK_CHARACTER_LIMIT = 1000;
/** The MVP helps with maths only (docs/product/mvp-scope.md). */
const MVP_SUBJECT = 'math';

/** The island (and place) a task was started from, validated on the server. */
export interface StartTopic {
  readonly areaId: string;
  readonly placeId: string | null;
  readonly subject: 'math' | 'german' | 'english' | 'general_studies';
  /** "Zahlenwald · Plus-Mulde", already translated. */
  readonly name: string;
}

interface TaskEntryProps {
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly childProfileId: string | null;
  /** The child's open task: a different one is started only after the child agreed. */
  readonly openTask: OpenTask | null;
  readonly topic?: StartTopic | null;
  /** What the parent stored: dictation only with it. */
  readonly voiceConsent?: boolean;
}

/** What the session starts with besides the task: the island's subject and place, or plain maths. */
function contextOf(topic: StartTopic | null) {
  if (topic === null) {
    return { subject: MVP_SUBJECT };
  }
  return {
    subject: topic.subject,
    areaId: topic.areaId,
    ...(topic.placeId === null ? {} : { placeId: topic.placeId }),
  };
}

/** The child's typed text stays on screen; nothing was sent to the AI or stored. */
function statusOf(code: string | undefined): 'distress' | 'failed' {
  return code === 'guidance.child_distress' ? 'distress' : 'failed';
}

/** Why the help did not start: a calm notice (no retry for distress); the typed task stays on screen. */
function StartNotice({ status }: { readonly status: string }) {
  const t = useTranslations('app');
  const tGuidance = useTranslations('guidance');
  if (status === 'unavailable') {
    return (
      <Alert variant="hint" role="status">
        <Lightbulb aria-hidden="true" />
        <AlertTitle>{t('start.entry.unavailableTitle')}</AlertTitle>
        <AlertDescription>{t('start.entry.unavailableBody')}</AlertDescription>
      </Alert>
    );
  }
  if (status === 'failed') {
    return (
      <p role="alert" className="text-nudge">
        {t('start.entry.failed')}
      </p>
    );
  }
  if (status !== 'distress') {
    return null;
  }
  return (
    <Alert variant="hint" role="alert">
      <Lightbulb aria-hidden="true" />
      <AlertDescription>{tGuidance('errors.childDistress')}</AlertDescription>
    </Alert>
  );
}

// @ui-plain textarea No shared Textarea primitive is installed yet.
// @unsaved-work none This transient task is submitted directly to start a session.
export function TaskEntry({
  draft,
  onDraftChange,
  childProfileId,
  openTask,
  topic = null,
  voiceConsent = false,
}: TaskEntryProps) {
  const t = useTranslations('app');
  const router = useRouter();
  const [status, setStatus] = useState<
    'editing' | 'invalid' | 'unavailable' | 'confirm' | 'failed' | 'distress'
  >('editing');
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
    // The same task again simply continues on the server; a different one would end the open one.
    if (
      openTask !== null &&
      (openTask.assignmentId !== null || openTask.task.trim() !== draft.trim())
    ) {
      setStatus('confirm');
      return;
    }
    start(childProfileId);
  }

  function start(profileId: string) {
    setStatus('editing');
    setPause(null);
    startTransition(async () => {
      const result = await startHelpSessionAction({
        childProfileId: profileId,
        task: draft,
        ...contextOf(topic),
      }).catch(() => null);
      if (result?.ok) {
        // Same address as now when no task was open: refresh so the page shows the new session.
        router.push('/help');
        router.refresh();
      } else {
        const learningPause = learningPauseOf(result?.error);
        setPause(learningPause);
        setStatus(learningPause === null ? statusOf(result?.error.code) : 'editing');
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
    <Card className="w-full">
      <CardContent className="gap-3 pt-5">
        {topic !== null && (
          <p className="text-copy-muted">{t('start.entry.topic', { name: topic.name })}</p>
        )}
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
          {childProfileId !== null && (
            <VoiceInputButton
              childProfileId={childProfileId}
              allowed={voiceConsent}
              onTranscript={onDraftChange}
            />
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
          {status === 'confirm' && openTask !== null && childProfileId !== null && (
            <ReplaceOpenTask
              openTask={openTask.task}
              isPending={isPending}
              onReplace={() => {
                start(childProfileId);
              }}
            />
          )}
          {pause !== null && <LearningPauseNote pause={pause} />}
          <StartNotice status={status} />
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
