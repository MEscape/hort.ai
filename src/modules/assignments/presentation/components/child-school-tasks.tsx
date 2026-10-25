'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Info } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

import { useCalendarDateText } from '../hooks/use-calendar-date-text';

import { ChildAssignmentPreview } from './child-assignment-preview';

import type { ChildAssignmentView } from '../../application/contracts/assignment-views';

interface SchoolTaskListProps {
  readonly assignments: readonly ChildAssignmentView[];
  readonly onOpen: (assignment: ChildAssignmentView) => void;
}

/** Mounted when the child arrives or comes back, so its heading takes focus each time. */
function SchoolTaskList({ assignments, onOpen }: SchoolTaskListProps) {
  const t = useTranslations('assignments');
  const dateText = useCalendarDateText();
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);

  return (
    <Card>
      <CardContent className="gap-5 py-8 sm:py-10">
        <h1 ref={headingRef} tabIndex={-1} className="font-heading text-3xl text-copy">
          {t('child.listTitle')}
        </h1>
        {assignments.length === 0 ? (
          <p className="text-lead text-copy-muted">{t('child.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {assignments.map((assignment) => (
              <li key={assignment.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full flex-col items-start gap-1 py-4 text-left whitespace-normal"
                  onClick={() => {
                    onOpen(assignment);
                  }}
                >
                  <span className="font-heading text-xl">{assignment.title}</span>
                  {assignment.dueDate !== null && (
                    <span className="text-sm font-normal text-copy-muted">
                      {t('child.due', { date: dateText(assignment.dueDate) })}
                    </span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface SchoolTaskProps {
  readonly assignment: ChildAssignmentView;
  readonly onBack: () => void;
  readonly startHelp?: ((assignment: ChildAssignmentView) => ReactNode) | undefined;
}

/** One opened task. The button that opened it is gone, so focus lands on the way back. */
function SchoolTask({ assignment, onBack, startHelp }: SchoolTaskProps) {
  const t = useTranslations('assignments');
  const backRef = useFocusOnMount<HTMLButtonElement>(true);

  return (
    <div className="space-y-5">
      <Button ref={backRef} type="button" variant="ghost" onClick={onBack}>
        {t('child.backToList')}
      </Button>
      <ChildAssignmentPreview assignment={assignment} />
      {startHelp === undefined ? (
        <Alert variant="hint" role="status">
          <Info aria-hidden="true" />
          <AlertTitle>{t('child.helpSoonTitle')}</AlertTitle>
          <AlertDescription>{t('child.helpSoonBody')}</AlertDescription>
        </Alert>
      ) : (
        startHelp(assignment)
      )}
    </div>
  );
}

interface ChildSchoolTasksProps {
  /** The child-safe projection of the class's assignments, loaded on the server. */
  readonly assignments: readonly ChildAssignmentView[];
  /**
   * The page's way to start help on the opened task (#83). Without it the screen says help comes
   * later instead of pretending; the assignments module itself knows nothing of help sessions.
   */
  readonly startHelp?: ((assignment: ChildAssignmentView) => ReactNode) | undefined;
}

/** The assignments of the child's class. Choosing one shows it, with the way to get help on it. */
export function ChildSchoolTasks({ assignments, startHelp }: ChildSchoolTasksProps) {
  const [selected, setSelected] = useState<ChildAssignmentView | null>(null);

  return selected === null ? (
    <SchoolTaskList assignments={assignments} onOpen={setSelected} />
  ) : (
    <SchoolTask
      assignment={selected}
      startHelp={startHelp}
      onBack={() => {
        setSelected(null);
      }}
    />
  );
}
