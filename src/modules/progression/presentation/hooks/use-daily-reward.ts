'use client';

import { useState, useTransition } from 'react';

import { claimDailyRewardAction } from '../actions/claim-daily-reward-action';
import { REQUEST_FAILED_CODE } from '../messages/message-keys';

import { useProgressionErrorText } from './use-progression-error-text';

import type { ProgressDto } from '../dto/progress-dto';

export type DailyRewardStatus = 'available' | 'pending' | 'granted' | 'already' | 'error';

interface RewardState {
  readonly progress: ProgressDto;
  readonly status: Exclude<DailyRewardStatus, 'pending'>;
  readonly leveledUp: boolean;
  readonly errorCode: string | null;
}

export interface DailyReward {
  /** The numbers the server last confirmed: what the meter draws. */
  readonly progress: ProgressDto;
  readonly status: DailyRewardStatus;
  /** True only when the server said this claim moved the child up a level. */
  readonly leveledUp: boolean;
  /** Why the last try failed, in words; `undefined` unless `status` is `error`. */
  readonly errorText: string | undefined;
  readonly claim: () => void;
}

function startState(progress: ProgressDto): RewardState {
  return {
    progress,
    status: progress.dailyReward.status === 'claimed' ? 'already' : 'available',
    leveledUp: false,
    errorCode: null,
  };
}

/**
 * The daily reward as the server confirms it. Nothing here decides anything: a claim is sent, and
 * only the answer moves the state: `granted` (celebrate, level-up only if the server says so),
 * `already_claimed` (calm, nothing celebrated) or a failure (message, the numbers stay as they were,
 * retry is the same call). A second tap while one is on its way does nothing.
 */
export function useDailyReward(initial: ProgressDto): DailyReward {
  const errorText = useProgressionErrorText();
  const [state, setState] = useState(() => startState(initial));
  const [isPending, startTransition] = useTransition();

  const claim = () => {
    if (isPending || state.status === 'granted' || state.status === 'already') {
      return;
    }
    startTransition(async () => {
      const result = await claimDailyRewardAction({
        childProfileId: state.progress.childProfileId,
      }).catch(() => null);
      if (result === null) {
        setState({ ...state, status: 'error', errorCode: REQUEST_FAILED_CODE });
      } else if (result.ok) {
        const { outcome, leveledUp, progress } = result.data;
        setState({
          progress,
          status: outcome === 'granted' ? 'granted' : 'already',
          leveledUp: outcome === 'granted' && leveledUp,
          errorCode: null,
        });
      } else {
        setState({ ...state, status: 'error', errorCode: result.error.code });
      }
    });
  };

  return {
    progress: state.progress,
    status: isPending ? 'pending' : state.status,
    leveledUp: state.leveledUp,
    errorText: state.status === 'error' ? errorText(state.errorCode ?? undefined) : undefined,
    claim,
  };
}
