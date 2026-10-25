import { WorldScene } from '@components/brand/world-scene';
import { Skeleton } from '@components/ui/skeleton';

import { getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

import {
  HOME_CARDS,
  HOME_GRID,
  HOME_MAIN,
  HOME_ROOT,
  HOME_STAGE,
  HOME_STAGE_SIZE,
} from './home-layout';

/** A card-sized white surface, the shape every real card has. */
const CARD = 'flex min-w-0 flex-col gap-3 rounded-token-xl bg-surface p-5 shadow-soft md:p-6';

/** The companion's stage as it will be: a round head, the level bar, the plate. */
function StageSkeleton() {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 md:flex md:flex-col md:gap-3">
      <Skeleton className="col-start-2 row-start-1 h-12 w-full md:max-w-72" />
      <Skeleton
        className={cn('col-start-1 row-span-3 row-start-1 rounded-full!', HOME_STAGE_SIZE)}
      />
      <Skeleton className="col-start-2 row-start-2 h-16 w-full rounded-full! md:h-20 md:max-w-72" />
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className={cn(CARD, 'md:gap-4')}>
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-1/2 self-center" />
    </div>
  );
}

function TeacherCardSkeleton() {
  return (
    <div className={cn(CARD, 'min-h-28 flex-row items-center gap-4 py-4')}>
      <Skeleton className="size-14 shrink-0 rounded-full!" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}

function WorldCardSkeleton() {
  return (
    <div className={CARD}>
      <Skeleton className="h-8 w-2/5" />
      <div className="flex items-end justify-center gap-2 py-2">
        <Skeleton className="h-20 w-1/4 rounded-full!" />
        <Skeleton className="h-24 w-1/3 rounded-full!" />
        <Skeleton className="h-20 w-1/4 rounded-full!" />
      </div>
      <Skeleton className="h-5 w-1/3" />
    </div>
  );
}

/**
 * The home page while it loads: the same frame, grid and card shapes as the finished page (the
 * lock, the stage, the task, teacher and world cards), so nothing jumps when it arrives. The
 * placeholders pulse only when motion is welcome.
 */
export async function HomeLoading() {
  const t = await getTranslations('app');
  return (
    <div className={HOME_ROOT} aria-busy="true">
      <WorldScene />
      <div className={HOME_MAIN}>
        <p role="status" className="sr-only">
          {t('loading')}
        </p>
        <div className="flex justify-end">
          <Skeleton className="size-12 rounded-full!" />
        </div>
        <div className={HOME_GRID}>
          <div className={HOME_STAGE}>
            <StageSkeleton />
          </div>
          <div className={HOME_CARDS}>
            <TaskCardSkeleton />
            <TeacherCardSkeleton />
            <WorldCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
