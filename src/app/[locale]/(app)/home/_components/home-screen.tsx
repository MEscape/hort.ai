'use client';

import { useRef } from 'react';

import { CompanionCard } from '@modules/progression/client';
import type { CompanionVisual, ProgressDto } from '@modules/progression/client';

import { WorldScene } from '@components/brand/world-scene';
import { StatusStrip } from '@components/shared/status-strip';

import { useTranslations } from '@i18n/client';

import { ContinueCard } from './continue-card';
import { GuideLayer } from './guide-layer';
import {
  HOME_CARDS,
  HOME_GRID,
  HOME_MAIN,
  HOME_ROOT,
  HOME_STAGE,
  HOME_STAGE_SIZE,
} from './home-layout';
import { TaskCard } from './task-card';
import { TeacherCard } from './teacher-card';
import { useHomeScreen } from './use-home-screen';
import { WorldCard } from './world-card';

import type { HomeData } from './home-types';

export interface HomeScreenProps {
  readonly data: HomeData;
  readonly companion: CompanionVisual;
  readonly progress: ProgressDto;
}

/**
 * What a child in grades 1 to 4 sees first: one companion, a few big cards and a quiet status
 * strip, no navigation bar. Everything is reached through the cards. The companion also guides:
 * it walks to a card, says one short line and goes home (`useHomeGuide`).
 */
export function HomeScreen({ data, companion, progress }: HomeScreenProps) {
  const t = useTranslations('app');
  const rootRef = useRef<HTMLDivElement>(null);
  const home = useHomeScreen(data, rootRef);
  const { guide } = home;
  const { activeTarget } = guide;

  return (
    <div ref={rootRef} className={HOME_ROOT}>
      <WorldScene />
      <main className={HOME_MAIN}>
        <h1 className="sr-only">{t('home.heading', { name: data.childName })}</h1>
        <div data-guide-target="strip">
          <StatusStrip
            time={home.stripTime}
            session={data.session}
            isOffline={!home.isOnline}
            onParentArea={home.openGate}
            onTimeTap={home.sayTime}
          />
        </div>
        <div className={HOME_GRID}>
          <div
            data-guide-target="stage"
            inert={home.isRestPaused}
            onPointerDownCapture={guide.stop}
            className={HOME_STAGE}
          >
            <CompanionCard
              companion={companion}
              progress={progress}
              avatarClassName={HOME_STAGE_SIZE}
              guided={guide.guided}
              avatarStyle={guide.avatarStyle}
              isSpeaking={guide.phase === 'speaking'}
              variant="home"
            />
          </div>
          <div className={HOME_CARDS}>
            <TaskCard
              companionName={companion.name}
              hasVoice={data.hasVoice}
              closed={home.closed}
              isGuided={activeTarget === 'task'}
              onPhoto={home.sayPhotoSoon}
              onVoiceInfo={home.sayVoiceOff}
              onAskAdult={home.openGate}
            />
            {data.unfinished !== null && (
              <ContinueCard
                task={data.unfinished}
                serverNow={data.serverNow}
                isGuided={activeTarget === 'continue'}
              />
            )}
            <TeacherCard newCount={data.teacherNewCount} isGuided={activeTarget === 'teacher'} />
            <div inert={home.isRestPaused}>
              <WorldCard
                childName={data.childName}
                islands={data.world}
                isGuided={activeTarget === 'world'}
              />
            </div>
          </div>
        </div>
      </main>
      <GuideLayer layout={guide.layout} text={guide.text} />
    </div>
  );
}
