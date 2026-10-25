import { useAppFormatters, useTranslations } from '@i18n/client';

import { ParentPanel } from './parent-panel';

import type {
  ParentAssignment,
  ParentLearningRecords,
} from '../../application/contracts/parent-learning-views';

const GROUPS = ['open', 'completed'] as const;

/** Finished wins; a session list that was cut off cannot confirm "not started" or "still open". */
function progressOf(assignment: ParentAssignment) {
  if (assignment.completed) {
    return 'completed';
  }
  if (assignment.progressPartial) {
    return 'unknown';
  }
  return assignment.started ? 'started' : 'new';
}

/** Teacher tasks come only from the current active class; a deadline is a Berlin calendar date. */
export function ParentAssignments({
  records,
  today,
}: {
  readonly records: ParentLearningRecords;
  readonly today: string;
}) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  return (
    <ParentPanel title={t('assignmentsTitle')} description={t('assignmentsDescription')}>
      {records.assignmentsTruncated && (
        <p role="note" className="mb-5 text-sm">
          {t('partial')}
        </p>
      )}
      {records.assignments.length === 0 ? (
        <p className="rounded-token-lg bg-background p-5 text-sm leading-relaxed text-copy-muted">
          {t('assignmentsEmpty')}
        </p>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => ({
            group,
            items: records.assignments.filter(
              (assignment) => assignment.completed === (group === 'completed'),
            ),
          }))
            .filter(({ items }) => items.length > 0)
            .map(({ group, items }) => (
              <section key={group}>
                <h3 className="border-b border-border pb-2 font-semibold">
                  {group === 'completed' ? t('status.COMPLETED') : t('assignmentsOpen')}
                </h3>
                <ul className="divide-y divide-border">
                  {items.map((assignment) => (
                    <li key={assignment.id} className="py-4">
                      <p className="break-words font-semibold">{assignment.title}</p>
                      <p className="mt-1 text-sm text-copy-muted">
                        {t(`subjects.${assignment.subject}`)}
                      </p>
                      <p className="mt-2 text-sm">
                        {t(`assignmentStatus.${progressOf(assignment)}`)}
                      </p>
                      <p className="mt-1 text-sm text-copy-muted">
                        {assignment.dueDate === null
                          ? t('noDue')
                          : t(
                              !assignment.completed && assignment.dueDate < today
                                ? 'overdue'
                                : 'due',
                              { date: format.date(`${assignment.dueDate}T12:00:00Z`) },
                            )}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      <p className="mt-5 border-t border-border pt-4 text-sm text-copy-muted">
        {t('assignmentActions')}
      </p>
    </ParentPanel>
  );
}
