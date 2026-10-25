'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useOnlineStatus } from '@hooks/use-online-status';

import { useRouter } from '@i18n';

import { CLOSED_KEEPS_COMPANION_AND_WORLD, closedReasonOf, stripTimeOf } from './screen-time-view';
import { useHomeGuide } from './use-home-guide';
import { useScreenTime } from './use-screen-time';

import type { HomeData } from './home-types';

type TimeLine = 'closedLimit' | 'closedWindow' | 'stripUnavailable' | 'stripTime';

/** Everything the home screen needs, wired once: the time, the guide and what each tap says. */
export function useHomeScreen(data: HomeData, rootRef: RefObject<HTMLDivElement | null>) {
  const { unfinished, serverNow } = data;
  const screenTime = useScreenTime({
    controls: data.controls,
    serverNow,
    usedMinutes: data.usedMinutes,
  });
  const isOnline = useOnlineStatus();
  const router = useRouter();
  const guide = useHomeGuide({
    rootRef,
    hasUnfinished: unfinished !== null,
    serverNow,
    speech: data.speech,
  });
  const { say } = guide;
  const closed = closedReasonOf(screenTime);
  const previousStatus = useRef(screenTime.status);

  // A gentle heads-up, said once when the last minutes begin.
  useEffect(() => {
    if (screenTime.status === 'low' && previousStatus.current !== 'low') {
      say('strip', 'low');
    }
    previousStatus.current = screenTime.status;
    // `say` reads the page when it is called; only a change of status should trigger it.
  }, [screenTime.status]);

  useEffect(() => {
    if (!isOnline) {
      say('strip', 'offline');
    }
  }, [isOnline]);

  const timeLine = (): TimeLine => {
    if (closed !== null) {
      return closed.reason === 'limit' ? 'closedLimit' : 'closedWindow';
    }
    return screenTime.usage.kind === 'unavailable' ? 'stripUnavailable' : 'stripTime';
  };

  return {
    guide,
    closed,
    /** True when a closed day also pauses feeding and the world (product's one flag). */
    isRestPaused: closed !== null && !CLOSED_KEEPS_COMPANION_AND_WORLD,
    isOnline,
    stripTime: stripTimeOf(screenTime),
    openGate: () => {
      guide.stop();
      router.push('/parent');
    },
    sayPhotoSoon: () => {
      say('task', 'photoSoon');
    },
    sayVoiceOff: () => {
      say('task', 'voiceOff');
    },
    sayTime: () => {
      say('strip', timeLine());
    },
  };
}
