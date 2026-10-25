'use client';

import { useState, useTransition } from 'react';

import {
  INTERESTS,
  LEARNER_ERROR_CODES,
  chooseChildTutorAction,
  completeChildWelcomeAction,
  learnerRoutes,
  saveChildInterestsAction,
} from '@modules/learner/client';
import type { ChildProfileDto, Interest } from '@modules/learner/client';

import { useRouter } from '@i18n';

import type { ActionResult } from '@lib/result';
import { clamp } from '@lib/utils';

export const WELCOME_STAGES = [
  'welcome',
  'interests',
  'companion',
  'voice',
  'rewards',
  'celebration',
] as const;
type WelcomeStage = (typeof WELCOME_STAGES)[number];

/** The steps after the companion was chosen: they speak about, with and for that companion. */
export const COMPANION_STAGES: readonly WelcomeStage[] = ['voice', 'rewards', 'celebration'];

interface Navigation {
  readonly index: number;
  /** `first` is the screen the child lands on: it is simply there, nothing slides in. */
  readonly direction: 'first' | 'forward' | 'back';
}

/** The stored interests, in the order of the closed list (and nothing the list does not know). */
function knownInterests(stored: readonly string[]): readonly Interest[] {
  return INTERESTS.filter((interest) => stored.includes(interest));
}

function isSameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

/**
 * The child's one-time welcome. The stored profile is the truth: every choice is sent to the
 * backend when the child leaves its screen and the flow moves on only after the backend said
 * "saved". A failed send keeps the screen, its choices and an error that can be tried again. The
 * home is entered only after the final call succeeded.
 */
export function useWelcomeFlow(profile: ChildProfileDto) {
  const router = useRouter();
  const [stored, setStored] = useState(profile);
  const [interests, setInterests] = useState(() => knownInterests(profile.interests));
  const [navigation, setNavigation] = useState<Navigation>({ index: 0, direction: 'first' });
  const [hasError, setHasError] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const goTo = (stage: WelcomeStage) => {
    setHasError(false);
    const index = WELCOME_STAGES.indexOf(stage);
    setNavigation((current) => ({
      index,
      direction: index < current.index ? 'back' : 'forward',
    }));
  };
  const step = (offset: 1 | -1) => {
    goTo(
      WELCOME_STAGES[clamp(navigation.index + offset, 0, WELCOME_STAGES.length - 1)] ?? 'welcome',
    );
  };

  /** Sends one change; `onSaved` runs only after the backend confirmed it. */
  const save = (
    send: () => Promise<ActionResult<ChildProfileDto>>,
    onSaved: (saved: ChildProfileDto) => void,
  ) => {
    if (isSaving) {
      return;
    }
    setHasError(false);
    startSaving(async () => {
      const result = await send().catch(() => null);
      if (result?.ok === true) {
        setStored(result.data);
        onSaved(result.data);
      } else if (result?.error.code === LEARNER_ERROR_CODES.welcomeAlreadyCompleted) {
        router.replace(learnerRoutes.home());
      } else {
        setHasError(true);
      }
    });
  };

  return {
    stage: WELCOME_STAGES[navigation.index] ?? 'welcome',
    index: navigation.index,
    direction: navigation.direction,
    interests,
    tutorId: stored.tutorId,
    isSaving,
    hasError,
    setInterests,
    next: () => {
      step(1);
    },
    back: () => {
      step(-1);
    },
    saveInterests: () => {
      if (isSameSet(interests, stored.interests)) {
        step(1);
        return;
      }
      save(
        () => saveChildInterestsAction({ profileId: stored.id, interests }),
        (saved) => {
          setInterests(knownInterests(saved.interests));
          goTo('companion');
        },
      );
    },
    chooseTutor: (tutorId: string) => {
      if (tutorId === stored.tutorId) {
        goTo('voice');
        return;
      }
      save(
        () => chooseChildTutorAction({ profileId: stored.id, tutorId }),
        () => {
          goTo('voice');
        },
      );
    },
    complete: () => {
      save(
        () => completeChildWelcomeAction({ profileId: stored.id }),
        () => {
          router.replace(learnerRoutes.home());
        },
      );
    },
  };
}
