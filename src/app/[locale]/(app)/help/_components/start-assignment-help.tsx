'use client';

import { useTransition, useState } from 'react';

import { startHelpSessionAction } from '@modules/guidance/client';

import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { ReplaceOpenTask } from './replace-open-task';

import type { OpenTask } from './replace-open-task';

/** The MVP helps with maths only (docs/product/mvp-scope.md). */
const MVP_SUBJECT = 'math';

interface StartAssignmentHelpProps {
  readonly childProfileId: string;
  readonly assignmentId: string;
  /** The child's open task: a different one is replaced only after the child agreed. */
  readonly openTask: OpenTask | null;
}

/**
 * Starts (or continues) help on a teacher's assignment (#33, #83). Only the id leaves the
 * browser: the server reads the task text and keeps the solution key to itself.
 */
export function StartAssignmentHelp({
  childProfileId,
  assignmentId,
  openTask,
}: StartAssignmentHelpProps) {
  const t = useTranslations('app');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isPending, startTransition] = useTransition();

  function start() {
    setFailed(false);
    startTransition(async () => {
      const result = await startHelpSessionAction({
        childProfileId,
        assignmentId,
        subject: MVP_SUBJECT,
      }).catch(() => null);
      if (result?.ok === true) {
        router.push('/help');
        router.refresh();
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        disabled={isPending}
        onClick={() => {
          // The same assignment simply continues on the server; another task would end the open one.
          if (openTask !== null && openTask.assignmentId !== assignmentId) {
            setIsAsking(true);
            return;
          }
          start();
        }}
      >
        {isPending ? t('start.entry.sending') : t('start.school.startHelp')}
      </Button>
      {isAsking && openTask !== null && (
        <ReplaceOpenTask openTask={openTask.task} isPending={isPending} onReplace={start} />
      )}
      {failed && (
        <p role="alert" className="text-nudge">
          {t('start.school.failed')}
        </p>
      )}
    </div>
  );
}
