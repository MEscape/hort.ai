'use client';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Lightbulb } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

const TASK_PREVIEW_LIMIT = 60;

/** The child's open help session, as far as the start screen needs it. */
export interface OpenTask {
  readonly task: string;
  /** Set when the open task is a teacher's assignment. */
  readonly assignmentId: string | null;
}

interface ReplaceOpenTaskProps {
  readonly openTask: string;
  readonly isPending: boolean;
  readonly onReplace: () => void;
}

/**
 * Asked before a different task replaces the open one: the backend keeps one open task per child,
 * so starting another ends it. Carrying on is the first, calm choice; nothing happens until the
 * child picks one.
 */
export function ReplaceOpenTask({ openTask, isPending, onReplace }: ReplaceOpenTaskProps) {
  const t = useTranslations('app');
  const task =
    openTask.length > TASK_PREVIEW_LIMIT ? `${openTask.slice(0, TASK_PREVIEW_LIMIT)}…` : openTask;
  return (
    <Alert
      variant="hint"
      role="status"
      // On a phone the question opens below the button: bring it into view (instantly, no motion).
      ref={(node) => {
        node?.scrollIntoView({ block: 'nearest' });
      }}
    >
      <Lightbulb aria-hidden="true" />
      <AlertTitle>{t('start.replace.title')}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t('start.replace.body', { task })}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/help">{t('start.replace.continue')}</Link>
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={isPending}
            onClick={onReplace}
          >
            {t('start.replace.startNew')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
