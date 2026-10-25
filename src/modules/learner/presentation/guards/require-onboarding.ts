import 'server-only';

import { redirect } from '@i18n';

import { getLocale } from '@i18n/server';

import { getLearnerQueries } from '../../composition';
import { toOnboardingStateDto } from '../dto/learner-dto';
import { learnerRoutes } from '../routes';

import type { OnboardingStateDto } from '../dto/learner-dto';

/**
 * Where the signed-in parent stands in the setup, read from the backend. Page-level navigation
 * only, NOT authorization: the query authorizes itself. A failure is unexpected and reaches
 * `error.tsx` instead of being mistaken for "not set up yet", which would send the parent in a loop.
 */
async function loadOnboardingState(): Promise<OnboardingStateDto> {
  const result = await getLearnerQueries().getOnboardingState.execute();
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  return toOnboardingStateDto(result.value);
}

/**
 * For the parent's home: a parent whose setup is not finished is sent into it. Returns the
 * finished state, so the home can link to the saved child profile.
 */
export async function requireOnboarded(): Promise<OnboardingStateDto> {
  const state = await loadOnboardingState();
  if (state.step !== 'done') {
    redirect({ href: learnerRoutes.onboarding(), locale: await getLocale() });
  }
  return state;
}

/** For the onboarding page: a finished parent never sees it again. */
export async function requireOnboarding(): Promise<OnboardingStateDto> {
  const state = await loadOnboardingState();
  if (state.step === 'done') {
    redirect({ href: learnerRoutes.home(), locale: await getLocale() });
  }
  return state;
}
