'use client';

import { Temporal } from 'temporal-polyfill';

import { Hort } from '@components/brand/hort';
import { Card, CardContent } from '@components/ui/card';

import { I18N_CONFIG } from '@i18n';

import { useAppFormatters, useTimeZone, useTranslations } from '@i18n/client';

import type { ChildAssignmentView } from '../dto/child-assignment-dto';

interface ChildAssignmentPreviewProps {
  readonly assignment: ChildAssignmentView;
}

/** Receives only the explicitly projected child DTO, never the teacher draft or solution key. */
export function ChildAssignmentPreview({ assignment }: ChildAssignmentPreviewProps) {
  const t = useTranslations('assignments');
  const format = useAppFormatters();
  const timeZone = useTimeZone() ?? I18N_CONFIG.defaultTimeZone;
  const dueDate =
    assignment.dueDate === null
      ? null
      : format.date(
          Temporal.PlainDate.from(assignment.dueDate).toZonedDateTime(timeZone).epochMilliseconds,
          { dateStyle: 'long' },
        );

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
        {assignment.dueDate !== null && dueDate !== null && (
          <p className="border-t border-border pt-4 text-base text-copy-muted">
            <time dateTime={assignment.dueDate}>{t('child.due', { date: dueDate })}</time>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
