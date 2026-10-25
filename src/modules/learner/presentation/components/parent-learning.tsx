import { useAppFormatters, useTranslations } from '@i18n/client';

import { ParentBars } from './parent-bars';
import { ParentHelp } from './parent-help';
import { ParentOutcomes } from './parent-outcomes';
import { ParentPanel } from './parent-panel';
import { ParentTaskList } from './parent-task-list';
import { ParentTopics } from './parent-topics';

import type {
  ParentLearningView,
  ParentTopics as ParentTopicsById,
} from '../../application/contracts/parent-learning-views';

/** The learning view is analytical without converting task exposure or replies into ability scores. */
/** `topics` is what the curriculum module said about the tasks' codes; the app route looks it up. */
export function ParentLearning({
  records,
  metrics,
  period,
  insightsEnabled,
  topics,
}: ParentLearningView & { readonly topics: ParentTopicsById }) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  const scope = t('period', { from: format.date(period.from), until: format.date(period.until) });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl">{t('learningTitle')}</h2>
        <p className="mt-2 text-copy-muted">{t('learningDescription')}</p>
        <p className="mt-2 text-xs text-copy-muted">{scope}</p>
      </div>
      {records.tasksTruncated && (
        <p role="note" className="rounded-token-lg bg-warning-subtle p-4 text-sm">
          {t('partial')}
        </p>
      )}
      {metrics.total > 0 && (
        <div className="rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6">
          <ParentOutcomes metrics={metrics} period={period} />
        </div>
      )}
      {metrics.total > 0 && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <ParentHelp metrics={metrics} insightsEnabled={insightsEnabled} scope={scope} />
          <ParentPanel title={t('evidenceTitle')} description={t('evidenceCaution')}>
            {insightsEnabled ? (
              <ul className="space-y-3 text-sm leading-relaxed">
                <li>
                  {metrics.answerKnownTasks === 0
                    ? t('ownAnswersUnavailable')
                    : t('ownAnswers', {
                        own: metrics.ownAnswerTasks,
                        tasks: metrics.answerKnownTasks,
                        correct: metrics.correctTasks,
                      })}
                </li>
                <li>{t('answered', { count: metrics.answeredTasks })}</li>
              </ul>
            ) : (
              <p className="text-sm">{t('insightsOff')}</p>
            )}
          </ParentPanel>
        </div>
      )}
      <ParentPanel title={t('tasksTitle')} description={t('tasksDescription')}>
        <ParentTaskList records={records} topics={topics} />
      </ParentPanel>
      {metrics.total > 0 && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="min-w-0 space-y-6">
            <div className="min-w-0 rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6">
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
            {insightsEnabled && metrics.insightTasks > 0 && (
              <div className="min-w-0 rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6">
                <ParentBars
                  title={t('hintTitle')}
                  description={t('hintDescription')}
                  scope={scope}
                  rows={metrics.hintDistribution.map((row) => ({
                    label: t('hints', { count: row.hints }),
                    value: row.tasks,
                  }))}
                />
                <p className="mt-5 text-sm text-copy-muted">
                  {t('hintScope', {
                    hints: metrics.hintTotal,
                    tasks: metrics.insightTasks,
                    supported: metrics.hintedTasks,
                  })}
                </p>
              </div>
            )}
          </div>
          <ParentTopics tasks={records.tasks} topics={topics} scope={scope} />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <ParentPanel title={t('practiceTitle')}>
          <p className="text-sm leading-relaxed text-copy-muted">{t('practiceUnavailable')}</p>
        </ParentPanel>
        <ParentPanel title={t('trendsTitle')}>
          <p className="text-sm leading-relaxed text-copy-muted">{t('trendsUnavailable')}</p>
        </ParentPanel>
      </div>
    </div>
  );
}
