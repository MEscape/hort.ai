import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Lock } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useCalendarDateText } from '../hooks/use-calendar-date-text';

import type { TeacherAssignmentView } from '../../application/contracts/assignment-views';

interface AssignmentListProps {
  readonly assignments: readonly TeacherAssignmentView[];
  readonly onEdit: (assignment: TeacherAssignmentView) => void;
  readonly onDelete: (assignment: TeacherAssignmentView) => void;
  readonly isBusy: boolean;
}

/** The teacher's saved assignments. The solution key is only flagged here, never printed. */
export function AssignmentList({ assignments, onEdit, onDelete, isBusy }: AssignmentListProps) {
  const t = useTranslations('assignments');
  const dateText = useCalendarDateText();

  return (
    <ul className="space-y-4">
      {assignments.map((assignment) => (
        <li key={assignment.id}>
          <Card>
            <CardContent className="gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <h3 className="break-words font-heading text-xl text-copy">{assignment.title}</h3>
                <p className="line-clamp-2 whitespace-pre-wrap break-words text-copy-muted">
                  {assignment.taskText}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-copy-muted">
                  {assignment.dueDate === null ? (
                    <span>{t('overview.noDue')}</span>
                  ) : (
                    <time dateTime={assignment.dueDate}>
                      {t('overview.due', { date: dateText(assignment.dueDate) })}
                    </time>
                  )}
                  {assignment.solutionKey !== null && (
                    <span className="flex items-center gap-1 text-primary-copy">
                      <Lock className="size-4" aria-hidden="true" />
                      {t('overview.hasSolution')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  aria-label={t('overview.editLabel', { title: assignment.title })}
                  onClick={() => {
                    onEdit(assignment);
                  }}
                >
                  {t('overview.edit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  aria-label={t('overview.deleteLabel', { title: assignment.title })}
                  onClick={() => {
                    onDelete(assignment);
                  }}
                >
                  {t('overview.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
