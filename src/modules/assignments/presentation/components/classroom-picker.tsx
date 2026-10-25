'use client';

import type { MouseEvent } from 'react';

import { Button } from '@components/ui/button';

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
}

/** The teacher's active classes as links, so the chosen class survives a reload and is shareable. */
export function ClassroomPicker({
  classrooms,
  selectedClassroomId,
  onSelect,
  isBlocked,
}: ClassroomPickerProps) {
  const t = useTranslations('assignments');

  return (
    <nav aria-label={t('page.classLabel')}>
      <ul className="flex flex-wrap gap-2">
        {classrooms.map((classroom) => {
          const isSelected = classroom.id === selectedClassroomId;
          const href = assignmentRoutes.teacherClassroom(classroom.id);
          return (
            <li key={classroom.id}>
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
