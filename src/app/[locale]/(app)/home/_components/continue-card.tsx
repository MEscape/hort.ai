'use client';

import { Button } from '@components/ui/button';
import { Play } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';
import { useAppFormatters } from '@i18n/formatters/client';

import { HOME_CARD_CLASSES, HomeCardBody } from './home-card-body';

import type { UnfinishedTask } from './home-types';

interface ContinueCardProps {
  readonly task: UnfinishedTask;
  /** The server's clock, so "2 h ago" does not depend on the device's. */
  readonly serverNow: string;
  readonly isGuided: boolean;
}

/** The last unfinished task in a few words, and one big way back into it. Never shows a solution. */
export function ContinueCard({ task, serverNow, isGuided }: ContinueCardProps) {
  const t = useTranslations('app');
  const formatters = useAppFormatters();
  return (
    <Button asChild variant="outline" className={HOME_CARD_CLASSES}>
      <Link data-guide-target="continue" href={task.href} data-guided={isGuided}>
        <HomeCardBody
          icon={Play}
          title={t('home.continue.heading', { title: task.title })}
          detail={t('home.continue.detail', {
            area: task.area,
            step: task.lastStep,
            time: formatters.relativeTime(task.updatedAt, serverNow),
          })}
        />
      </Link>
    </Button>
  );
}
