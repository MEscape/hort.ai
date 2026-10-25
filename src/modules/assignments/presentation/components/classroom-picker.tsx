'use client';

import type { MouseEvent, ReactNode } from 'react';

import { Button } from '@components/ui/button';
import { Info } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { assignmentRoutes } from '../routes';

import type { TeacherClassroomView } from '../../application/contracts/assignment-views';

interface ClassroomPickerProps {
  readonly classrooms: readonly TeacherClassroomView[];
  readonly selectedClassroomId: string;
  /** Called before a switch; it may cancel the navigation (unsaved changes, a running save). */
  readonly onSelect: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  readonly isBlocked: boolean;
  /** Shown after the classes in the same row, e.g. "Add class"; owned by the classroom module. */
  readonly actions?: ReactNode;
}

/**
 * The teacher's active classes as links, so the chosen class survives a reload and is shareable.
 * Each has its own info link: opening details keeps the selected class (and any draft) as it is.
 */
export function ClassroomPicker({
  classrooms,
  selectedClassroomId,
  onSelect,
  isBlocked,
  actions,
}: ClassroomPickerProps) {
  const t = useTranslations('assignments');

  return (
    <nav aria-label={t('page.classLabel')} className="flex flex-wrap items-center gap-2">
      <ul className="flex flex-wrap items-center gap-2">
        {classrooms.map((classroom) => {
          const isSelected = classroom.id === selectedClassroomId;
          const href = assignmentRoutes.teacherClassroom(classroom.id);
          return (
            <li key={classroom.id} className="flex items-center">
              <Button asChild variant={isSelected ? 'default' : 'outline'} size="sm">
                <Link
                  href={href}
                  aria-current={isSelected ? 'page' : undefined}
                  aria-disabled={isBlocked || undefined}
                  onClick={(event) => {
                    onSelect(event, href);
                  }}
                >
                  {classroom.name}
                  <span className="font-normal opacity-80">
                    {t('page.classGrade', { grade: classroom.grade })}
                  </span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-10 px-0">
                <Link
                  href={assignmentRoutes.teacherClassroomDetails(selectedClassroomId, classroom.id)}
                  scroll={false}
                  aria-label={t('page.classDetails', { name: classroom.name })}
                >
                  <Info aria-hidden="true" />
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
      {actions}
    </nav>
  );
}
