'use client';

import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { assignmentRoutes } from '../routes';

import type { TeacherClassroomView } from '../../application/contracts/assignment-views';

interface ClassroomPickerProps {
  readonly classrooms: readonly TeacherClassroomView[];
  readonly selectedClassroomId: string;
}

/** The teacher's active classes as links, so the chosen class survives a reload and is shareable. */
export function ClassroomPicker({ classrooms, selectedClassroomId }: ClassroomPickerProps) {
  const t = useTranslations('assignments');

  return (
    <nav aria-label={t('page.classLabel')}>
      <ul className="flex flex-wrap gap-2">
        {classrooms.map((classroom) => {
          const isSelected = classroom.id === selectedClassroomId;
          return (
            <li key={classroom.id}>
              <Button asChild variant={isSelected ? 'default' : 'outline'} size="sm">
                <Link
                  href={assignmentRoutes.teacherClassroom(classroom.id)}
                  aria-current={isSelected ? 'page' : undefined}
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
