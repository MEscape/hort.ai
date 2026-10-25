'use client';

import { Button } from '@components/ui/button';
import { School } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { HOME_CARD_CLASSES, HomeCardBody } from './home-card-body';

/** The class's assignments live on "/start" ("From school"), where the child gets help on one. */
const SCHOOL_TASKS_HREF = '/start';

interface TeacherCardProps {
  /** New assignments, or `null` while they cannot be loaded yet. */
  readonly newCount: number | null;
  readonly isGuided: boolean;
  readonly onTap: () => void;
}

/**
 * Tasks from the teacher. The number is always written ("2 neu"), never only a colour. The card
 * opens the school tasks on "/start"; tapping it also lets the companion say what is there.
 */
export function TeacherCard({ newCount, isGuided, onTap }: TeacherCardProps) {
  const t = useTranslations('app');
  const hasNew = newCount !== null && newCount > 0;
  const detail = hasNew
    ? t('home.teacher.new', { count: newCount })
    : t(newCount === null ? 'home.teacher.soon' : 'home.teacher.none');
  return (
    <Button
      asChild
      data-guide-target="teacher"
      variant="outline"
      data-guided={isGuided}
      className={HOME_CARD_CLASSES}
    >
      <Link href={SCHOOL_TASKS_HREF} onClick={onTap}>
        <HomeCardBody icon={School} title={t('home.teacher.title')} detail={detail} />
      </Link>
    </Button>
  );
}
