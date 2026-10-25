'use client';

import { Button } from '@components/ui/button';
import { School } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { HOME_CARD_CLASSES, HomeCardBody } from './home-card-body';

/** The help canvas asking for a task lists the class's assignments as big choices. */
const SCHOOL_TASKS_HREF = '/help?new=1';

interface TeacherCardProps {
  /** Open assignments, or `null` while they cannot be counted. */
  readonly newCount: number | null;
  readonly isGuided: boolean;
}

/**
 * Tasks from the teacher, one tap away. The number is always written ("2 new"), never only a
 * colour; without a count the card is a plain way to the school tasks.
 */
export function TeacherCard({ newCount, isGuided }: TeacherCardProps) {
  const t = useTranslations('app');
  const counted =
    newCount !== null && newCount > 0
      ? t('home.teacher.new', { count: newCount })
      : t('home.teacher.none');
  const detail = newCount === null ? t('home.teacher.open') : counted;
  return (
    <Button asChild variant="outline" className={HOME_CARD_CLASSES}>
      <Link data-guide-target="teacher" href={SCHOOL_TASKS_HREF} data-guided={isGuided}>
        <HomeCardBody icon={School} title={t('home.teacher.title')} detail={detail} />
      </Link>
    </Button>
  );
}
