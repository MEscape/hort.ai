import { Link } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import {
  PARENT_ANSWER_RESULTS,
  PARENT_HINT_LEVELS,
} from '../../application/contracts/parent-learning-views';
import { learnerRoutes } from '../routes';

import { ParentPanel } from './parent-panel';

import type { ParentTask } from '../../application/contracts/parent-learning-views';

/** Only minimized evidence leaves storage; an answered question is never labelled as understanding. */
export function ParentTaskDetail({ task }: { readonly task: ParentTask }) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  return (
    <div className="space-y-6">
      <Link
        href={learnerRoutes.parent('learning')}
        prefetch={false}
        className="inline-flex min-h-11 items-center font-semibold text-primary-copy underline underline-offset-4"
      >
        {t('backToLearning')}
      </Link>
      <ParentPanel
        title={t('taskFallback', { date: format.dateTime(task.startedAt) })}
        description={t('taskUntitled')}
      >
        <p className="font-semibold">{t(`status.${task.status}`)}</p>
        <dl className="mt-4 divide-y divide-border">
          <div className="grid gap-1 py-3 sm:grid-cols-2">
            <dt className="text-copy-muted">{t('started')}</dt>
            <dd>{format.dateTime(task.startedAt)}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-2">
            <dt className="text-copy-muted">{t('ended')}</dt>
            <dd>{task.endedAt === null ? t('notEnded') : format.dateTime(task.endedAt)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-copy-muted">
          {t('taskUpdated', { date: format.dateTime(task.updatedAt) })}
        </p>
        {task.evidencePartial && (
          <p role="note" className="mt-4 text-sm">
            {t('evidencePartial')}
          </p>
        )}
      </ParentPanel>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ParentPanel title={t('helpTitle')} description={t('helpTaskDescription')}>
          {task.hintCount === null ? (
            <p className="text-sm text-copy-muted">{t('hintUnavailable')}</p>
          ) : (
            <>
              <p className="font-semibold">{t('workedWithHints', { count: task.hintCount })}</p>
              {task.hintCount > 0 && (
                <ol className="mt-4 space-y-2" aria-label={t('helpLadder')}>
                  {PARENT_HINT_LEVELS.map((level) => (
                    <li key={level} className="flex items-start gap-3 text-sm">
                      <span
                        aria-hidden="true"
                        className={`mt-1 size-3 shrink-0 rounded-full border border-border-strong ${task.hintLevels.includes(level) ? 'bg-chart-1' : 'bg-surface'}`}
                      />
                      <span
                        className={
                          task.hintLevels.includes(level) ? 'text-copy' : 'text-copy-muted'
                        }
                      >
                        {t(`helpLevels.${level}`)}
                        <span className="sr-only">
                          {' '}
                          {task.hintLevels.includes(level) ? t('helpUsed') : t('helpNotUsed')}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </ParentPanel>
        <ParentPanel title={t('ownAnswersTitle')} description={t('ownAnswersDescription')}>
          {task.answers === null ? (
            <p className="text-sm text-copy-muted">{t('ownAnswersUnavailable')}</p>
          ) : (
            <>
              <p className="font-semibold">{t('answersGiven', { count: task.answers.given })}</p>
              {task.answers.given > 0 && (
                <dl className="mt-4 divide-y divide-border text-sm">
                  {PARENT_ANSWER_RESULTS.map((result) => (
                    <div key={result} className="flex justify-between gap-4 py-2">
                      <dt>{t(`answerResults.${result}`)}</dt>
                      <dd className="font-semibold tabular-nums">
                        {format.number(task.answers?.results[result] ?? 0)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          )}
        </ParentPanel>
      </div>
      <ParentPanel title={t('comprehension')} description={t('evidenceCaution')}>
        <p>
          {task.questionsAsked === null || task.questionsAnswered === null
            ? t('comprehensionUnavailable')
            : t('comprehensionCount', {
                asked: task.questionsAsked,
                answered: task.questionsAnswered,
              })}
        </p>
      </ParentPanel>
      <ParentPanel title={t('topicsTitle')} description={t('topicsDescription')}>
        {task.competencyCodes.length === 0 ? (
          <p className="text-sm text-copy-muted">{t('topicsUnavailable')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {task.competencyCodes.map((code) => (
              <li key={code} className="break-all rounded-token-sm bg-sunken px-3 py-2 text-sm">
                {code}
              </li>
            ))}
          </ul>
        )}
      </ParentPanel>
      <ParentPanel title={t('homeSuggestion')}>
        <p className="text-sm text-copy-muted">{t('homeUnavailable')}</p>
      </ParentPanel>
      <p className="text-sm leading-relaxed text-copy-muted">{t('detailPrivacy')}</p>
    </div>
  );
}
