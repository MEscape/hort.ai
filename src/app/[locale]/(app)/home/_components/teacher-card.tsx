'use client';

import { Button } from '@components/ui/button';
import { School } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { HOME_CARD_CLASSES, HomeCardBody } from './home-card-body';

interface TeacherCardProps {
  /** New assignments, or `null` while they cannot be loaded yet. */
  readonly newCount: number | null;
  readonly isGuided: boolean;
  readonly onTap: () => void;
}

/**
 * Tasks from the teacher. The number is always written ("2 neu"), never only a colour. An empty or
 * not-yet-available card stays on the page: tapping it lets the companion say so.
 */
export function TeacherCard({ newCount, isGuided, onTap }: TeacherCardProps) {
  const t = useTranslations('app');
  const hasNew = newCount !== null && newCount > 0;
  const detail = hasNew
    ? t('home.teacher.new', { count: newCount })
    : t(newCount === null ? 'home.teacher.soon' : 'home.teacher.none');
  return (
    <Button
      data-guide-target="teacher"
      type="button"
      variant="outline"
      data-guided={isGuided}
      onClick={onTap}
      className={HOME_CARD_CLASSES}
    >
      <HomeCardBody icon={School} title={t('home.teacher.title')} detail={detail} />
    </Button>
  );
}
