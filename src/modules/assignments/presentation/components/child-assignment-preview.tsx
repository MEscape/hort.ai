'use client';

import { Hort } from '@components/brand/hort';
import { Card, CardContent } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

import { useCalendarDateText } from '../hooks/use-calendar-date-text';

import type { ChildAssignmentContent } from '../dto/child-assignment-dto';

interface ChildAssignmentPreviewProps {
  readonly assignment: ChildAssignmentContent;
}

/** Receives only the explicitly projected child content, never the teacher draft or solution key. */
export function ChildAssignmentPreview({ assignment }: ChildAssignmentPreviewProps) {
  const t = useTranslations('assignments');
  const dateText = useCalendarDateText();

  return (
    <Card>
      <CardContent className="gap-6 py-8 sm:py-10">
        <div className="flex items-center gap-5">
          <Hort mood="think" className="size-24 shrink-0" />
          <h2 className="min-w-0 break-words font-heading text-3xl text-copy">
            {assignment.title}
          </h2>
        </div>
        <p className="whitespace-pre-wrap break-words text-lead text-copy">{assignment.taskText}</p>
        {assignment.dueDate !== null && (
          <p className="border-t border-border pt-4 text-base text-copy-muted">
            <time dateTime={assignment.dueDate}>
              {t('child.due', { date: dateText(assignment.dueDate) })}
            </time>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
