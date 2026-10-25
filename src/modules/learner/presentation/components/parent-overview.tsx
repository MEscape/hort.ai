import type { ReactNode } from 'react';

import { Link } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { learnerRoutes } from '../routes';

import { ParentBars } from './parent-bars';
import { ParentHelp } from './parent-help';
import { ParentPanel } from './parent-panel';
import { ParentTaskList, useTaskTitle } from './parent-task-list';

import type { ParentLearningView } from '../../application/contracts/parent-learning-views';

const RECENT_UPDATES = 5;

/** Tasks lead the overview; deeper analysis and controls stay in their own navigation sections. */
export function ParentOverview({
  records,
  metrics,
  period,
  insightsEnabled,
  companion,
}: ParentLearningView & { readonly companion: ReactNode }) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  const titleOf = useTaskTitle();
  const scope = t('period', { from: format.date(period.from), until: format.date(period.until) });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl">{t('overviewTitle')}</h2>
        <p className="mt-2 text-copy-muted">{t('overviewDescription')}</p>
        <p className="mt-2 text-xs text-copy-muted">{scope}</p>
      </div>
      {(records.tasksTruncated || records.assignmentsTruncated) && (
        <p role="note" className="rounded-token-lg bg-warning-subtle p-4 text-sm">
          {t('partial')}
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ParentPanel title={t('tasksTitle')} description={t('tasksDescription')}>
          <ParentTaskList records={records} />
        </ParentPanel>
        <div className="space-y-6">
          {metrics.total > 0 && (
            <ParentHelp metrics={metrics} insightsEnabled={insightsEnabled} scope={scope} />
          )}
          {metrics.total > 0 && (
            <div className="rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6">
              <ParentBars
                title={t('subjectsTitle')}
                description={t('subjectsDescription')}
                scope={scope}
                rows={metrics.subjects.map((row) => ({
                  label: t(`subjects.${row.subject}`),
                  value: row.count,
                }))}
              />
            </div>
          )}
          {companion}
        </div>
      </div>
      {metrics.total > 0 && (
        <ParentPanel title={t('activityTitle')} description={t('activityDescription')}>
          <ol className="divide-y divide-border">
            {[...records.tasks]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, RECENT_UPDATES)
              .map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                >
                  <span className="min-w-0">
                    <Link
                      href={learnerRoutes.parentTask(task.id)}
                      prefetch={false}
                      className="break-words font-semibold text-primary-copy underline underline-offset-4"
                    >
                      {titleOf(records, task)}
                    </Link>
                    <span className="block text-sm text-copy-muted">
                      {t(`status.${task.status}`)}
                    </span>
                  </span>
                  <time dateTime={task.updatedAt} className="text-sm text-copy-muted">
                    {format.dateTime(task.updatedAt)}
                  </time>
                </li>
              ))}
          </ol>
        </ParentPanel>
      )}
    </div>
  );
}
