'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useSpokenLine } from '@modules/voice/client';

import { dwellMsFor } from '@hooks/guide-reducer';
import { useCalmMotion } from '@hooks/use-calm-motion';
import { useGuide } from '@hooks/use-guide';

import { useTranslations } from '@i18n/client';

import { pickGreeting, shouldGreet } from './greeting';
import { readGreetingMemory, writeGreetingMemory } from './greeting-memory';
import { measureGuide } from './measure-guide';
import { GUIDE_SCALE } from './place-guide';

import type { GuideLine, GuideTarget } from './home-types';
import type { GuidePlace } from './measure-guide';

/** Waits for the page to settle (pictures, layout) before the greeting speaks. */
const GREETING_DELAY_MS = 700;

export interface GuideLayout extends GuidePlace {
  /** The line being said, with the target it was said for. */
  readonly line: GuideLine;
  readonly target: GuideTarget;
}

interface UseHomeGuideOptions {
  /** The page's root element: the guide measures everything relative to it. */
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly hasUnfinished: boolean;
  readonly serverNow: string;
  /** Who says the lines aloud, and whether sound is allowed at all. */
  readonly speech: { readonly speakerId: string; readonly isAllowed: boolean };
}

/**
 * The home screen's guide: knows where the stage and the cards are, turns a tap into one short,
 * fixed line (text first, and spoken in the companion's own voice when sound is allowed) and a
 * place to stand, and greets once on arrival. The stage's line takes the place of the level
 * meter, which fades while it is said, so nothing is covered.
 */
export function useHomeGuide({ rootRef, hasUnfinished, serverNow, speech }: UseHomeGuideOptions) {
  const t = useTranslations('app');
  const isCalm = useCalmMotion();
  const guide = useGuide();
  const voice = useSpokenLine(speech);
  const [layout, setLayout] = useState<GuideLayout | null>(null);
  const greetingTimer = useRef<number | undefined>(undefined);

  const say = (target: GuideTarget, line: GuideLine) => {
    window.clearTimeout(greetingTimer.current);
    const place = rootRef.current === null ? null : measureGuide(rootRef.current, target, isCalm);
    if (place === null) {
      return;
    }
    setLayout({ line, target, ...place });
    guide.pointAt(target, line, {
      dwellMs: dwellMsFor(t(`home.guide.${line}`)),
      moves: place.companion !== null,
    });
    void voice.speak(line);
  };

  useEffect(() => {
    const now = Date.parse(serverNow);
    const memory = readGreetingMemory();
    if (!shouldGreet(memory, now)) {
      return undefined;
    }
    greetingTimer.current = window.setTimeout(() => {
      const greeting = pickGreeting({ hasUnfinished });
      writeGreetingMemory({ line: greeting.line, at: now });
      say(greeting.target, greeting.line);
    }, GREETING_DELAY_MS);
    return () => {
      window.clearTimeout(greetingTimer.current);
    };
    // The greeting is for the arrival only: later renders must not say it again.
  }, []);

  const { phase, hasMoved } = guide.state;
  const isSpeaking = phase === 'speaking';
  const guided = guidedOf(phase, hasMoved, layout?.target === 'stage');
  const text = isSpeaking && layout !== null ? t(`home.guide.${layout.line}`) : null;
  const activeTarget = isSpeaking && layout !== null ? layout.target : null;
  const avatarStyle = shiftOf(layout, phase, isCalm);

  return {
    say,
    stop: () => {
      window.clearTimeout(greetingTimer.current);
      guide.stop();
      voice.stop();
    },
    phase,
    hasMoved,
    layout,
    guided,
    text,
    activeTarget,
    avatarStyle,
  };
}

/** What the stage should know: its own line is on (`speaking`), or the companion is away at a card. */
function guidedOf(
  phase: string,
  hasMoved: boolean,
  isAtStage: boolean,
): 'speaking' | 'away' | undefined {
  if (phase === 'home') {
    return undefined;
  }
  if (hasMoved) {
    return 'away';
  }
  return isAtStage ? 'speaking' : undefined;
}

/** Where the original companion is moved to while it walks to a card, or `undefined` at home. */
function shiftOf(
  layout: GuideLayout | null,
  phase: string,
  isCalm: boolean,
): { transform: string } | undefined {
  const at = layout?.companion;
  const isAway = phase === 'walking' || phase === 'speaking';
  if (layout === null || !at || !isAway || isCalm) {
    return undefined;
  }
  const { home } = layout;
  const dx = at.x - home.left - home.width / 2;
  const dy = at.y - home.top - home.height / 2;
  return { transform: `translate(${dx}px, ${dy}px) scale(${GUIDE_SCALE})` };
}
