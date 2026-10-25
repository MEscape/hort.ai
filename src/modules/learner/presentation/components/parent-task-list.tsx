import { Link } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { learnerRoutes } from '../routes';

import type {
  ParentLearningRecords,
  ParentTask,
} from '../../application/contracts/parent-learning-views';

const STATUSES = ['COMPLETED', 'ACTIVE', 'ABANDONED'] as const;

/** The assignment a task belongs to; a task the child brought in has none, so no title or subject. */
const assignmentOf = (records: ParentLearningRecords, task: ParentTask) =>
  records.assignments.find((assignment) => assignment.id === task.assignmentId);

/** The assignment's title, or the start time when the task text is the child's own and stays private. */
export function useTaskTitle() {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  return (records: ParentLearningRecords, task: ParentTask) =>
    assignmentOf(records, task)?.title ??
    t('taskFallback', { date: format.dateTime(task.startedAt) });
}

/** Status headings stay separate: an active session is never counted as paused or finished. */
export function ParentTaskList({ records }: { readonly records: ParentLearningRecords }) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  const titleOf = useTaskTitle();
  if (records.tasks.length === 0) {
    return (
      <div className="rounded-token-lg bg-background p-6">
        <h3 className="font-heading text-xl">{t('emptyTitle')}</h3>
        <p className="mt-2 text-sm leading-relaxed text-copy-muted">{t('emptyDescription')}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {STATUSES.map((status) => (
        <section key={status} aria-label={t(`status.${status}`)}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
            <h3 className="font-semibold">{t(`status.${status}`)}</h3>
            <span className="text-sm text-copy-muted">
              {t('statusSummary', {
                count: records.tasks.filter((task) => task.status === status).length,
              })}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {records.tasks
              .filter((task) => task.status === status)
              .map((task) => (
                <li key={task.id}>
                  <Link
                    href={learnerRoutes.parentTask(task.id)}
                    prefetch={false}
                    className="group flex min-h-14 flex-col gap-1 rounded-token-sm px-2 py-3 hover:bg-highlight"
                  >
                    <span className="break-words font-semibold text-primary-copy group-hover:underline">
                      {titleOf(records, task)}
                    </span>
                    <span className="text-sm text-copy-muted">
                      {t(`subjects.${assignmentOf(records, task)?.subject ?? 'unknown'}`)}
                      {task.hintCount !== null &&
                        ` · ${t('workedWithHints', { count: task.hintCount })}`}
                    </span>
                    <span className="text-xs text-copy-muted">
                      {t('taskUpdated', { date: format.dateTime(task.updatedAt) })}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
          {status === 'COMPLETED' && !records.tasks.some((task) => task.status === status) && (
            <p className="pt-3 text-sm text-copy-muted">{t('noCompleted')}</p>
          )}
        </section>
      ))}
      <p className="text-sm text-copy-muted">{t('missingPaused')}</p>
    </div>
  );
}
