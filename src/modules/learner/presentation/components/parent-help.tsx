import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { learnerRoutes } from '../routes';

import { ParentBars } from './parent-bars';
import { ParentPanel } from './parent-panel';

import type { ParentLearningMetrics } from '../../application/contracts/parent-learning-views';

/**
 * Answers the parent's first question from the vision: where did the child need help? Each bar is
 * a rung of the hint ladder and counts tasks, so one long session does not outweigh several short
 * ones. With notes off nothing is shown, and nothing is guessed.
 */
export function ParentHelp({
  metrics,
  insightsEnabled,
  scope,
}: {
  readonly metrics: ParentLearningMetrics;
  readonly insightsEnabled: boolean;
  readonly scope: string;
}) {
  const t = useTranslations('learner.dashboard');
  if (!insightsEnabled) {
    return (
      <ParentPanel title={t('helpTitle')}>
        <p className="text-sm leading-relaxed text-copy-muted">{t('insightsOff')}</p>
        <Link
          href={learnerRoutes.parent('settings')}
          prefetch={false}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary-copy underline underline-offset-4"
        >
          {t('openSettings')}
        </Link>
      </ParentPanel>
    );
  }
  if (metrics.insightTasks === 0) {
    return (
      <ParentPanel title={t('helpTitle')}>
        <p className="text-sm leading-relaxed text-copy-muted">{t('helpEmpty')}</p>
      </ParentPanel>
    );
  }
  return (
    <div className="min-w-0 rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6">
      <ParentBars
        title={t('helpTitle')}
        description={t('helpDescription')}
        scope={scope}
        maximum={metrics.insightTasks}
        rows={metrics.helpLevels.map((row) => ({
          label: t(`helpLevels.${row.level}`),
          value: row.tasks,
        }))}
      />
      <p className="mt-5 text-sm text-copy-muted">
        {t('helpScope', {
          tasks: metrics.insightTasks,
          unaided: metrics.insightTasks - metrics.hintedTasks,
        })}
      </p>
    </div>
  );
}
