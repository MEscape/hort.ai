import { useTranslations } from '@i18n/client';

import { PARENT_SUBJECTS } from '../../application/contracts/parent-learning-views';

import { ParentPanel } from './parent-panel';

import type {
  ParentSubject,
  ParentTask,
  ParentTopics as ParentTopicsById,
} from '../../application/contracts/parent-learning-views';

interface ExploredTopic {
  readonly subject: ParentSubject;
  readonly label: string;
  readonly tasks: number;
}

/**
 * Tasks per curriculum topic and subject, most tasks first. A topic is named by its section, or by
 * its statement when the curriculum has no section. Tasks without a described topic are counted
 * apart, never guessed into one.
 */
export function exploredTopics(tasks: readonly ParentTask[], topics: ParentTopicsById) {
  const counts = new Map<string, ExploredTopic>();
  let unclassified = 0;
  for (const task of tasks) {
    const topic = task.competencyCode === null ? undefined : topics[task.competencyCode];
    if (topic === undefined) {
      unclassified += 1;
      continue;
    }
    const label = topic.section ?? topic.statement;
    const key = JSON.stringify([task.subject, label]);
    const current = counts.get(key) ?? { subject: task.subject, label, tasks: 0 };
    counts.set(key, { ...current, tasks: current.tasks + 1 });
  }
  const explored = [...counts.values()].sort(
    (a, b) => b.tasks - a.tasks || a.label.localeCompare(b.label),
  );
  return { explored, unclassified };
}

/**
 * Curriculum topics the tasks were matched to, grouped by subject. A list rather than a chart: the
 * names are long, and the count says how often a topic came up, not how well.
 */
export function ParentTopics({
  tasks,
  topics,
  scope,
}: {
  readonly tasks: readonly ParentTask[];
  readonly topics: ParentTopicsById;
  readonly scope: string;
}) {
  const t = useTranslations('learner.dashboard');
  const { explored, unclassified } = exploredTopics(tasks, topics);
  const subjects = PARENT_SUBJECTS.filter((subject) =>
    explored.some((topic) => topic.subject === subject),
  );
  return (
    <ParentPanel title={t('topicsExploredTitle')} description={t('topicsExploredDescription')}>
      <p className="-mt-2 mb-4 text-xs text-copy-muted">{scope}</p>
      {subjects.length === 0 ? (
        <p className="text-sm text-copy-muted">{t('topicsExploredEmpty')}</p>
      ) : (
        <div className="space-y-5">
          {subjects.map((subject) => (
            <section key={subject} aria-label={t(`subjects.${subject}`)}>
              <h3 className="border-b border-border pb-2 font-semibold">
                {t(`subjects.${subject}`)}
              </h3>
              <ul className="divide-y divide-border">
                {explored
                  .filter((topic) => topic.subject === subject)
                  .map((topic) => (
                    <li
                      key={topic.label}
                      className="flex items-baseline justify-between gap-4 py-3 text-sm"
                    >
                      <span lang="de" className="min-w-0 break-words">
                        {topic.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-copy-muted">
                        {t('statusSummary', { count: topic.tasks })}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {unclassified > 0 && (
        <p className="mt-4 text-sm text-copy-muted">
          {t('topicsUnclassified', { count: unclassified, total: tasks.length })}
        </p>
      )}
    </ParentPanel>
  );
}
