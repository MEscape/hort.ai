import 'server-only';

import { redirect } from '@i18n';

import { getLocale } from '@i18n/server';

import { getLearnerQueries } from '../../composition';
import { toOnboardingStateDto } from '../dto/learner-dto';
import { learnerRoutes } from '../routes';

import type { ChildProfileDto, OnboardingStateDto } from '../dto/learner-dto';

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
 * For the parent's home: a parent whose setup is not finished is sent into it, and one whose child
 * has not done their welcome yet is sent there. Returns the child's profile for what the home shows.
 */
export async function requireOnboarded(): Promise<ChildProfileDto> {
  const { step, profile } = await loadOnboardingState();
  if (step !== 'done' || profile === null) {
    return redirect({ href: learnerRoutes.onboarding(), locale: await getLocale() });
  }
  if (profile.welcomeCompletedAt === null) {
    return redirect({ href: learnerRoutes.welcome(), locale: await getLocale() });
  }
  return profile;
}

/**
 * For the welcome page: the setup must be finished (else back into it) and the welcome still open
 * (else on to the home). Returns the profile the welcome edits.
 */
export async function requireChildWelcome(): Promise<ChildProfileDto> {
  const { step, profile } = await loadOnboardingState();
  if (step !== 'done' || profile === null) {
    return redirect({ href: learnerRoutes.onboarding(), locale: await getLocale() });
  }
  if (profile.welcomeCompletedAt !== null) {
    return redirect({ href: learnerRoutes.home(), locale: await getLocale() });
  }
  return profile;
}

/** For the onboarding page: a finished parent never sees it again. */
export async function requireOnboarding(): Promise<OnboardingStateDto> {
  const state = await loadOnboardingState();
  if (state.step === 'done') {
    redirect({ href: learnerRoutes.home(), locale: await getLocale() });
  }
  return state;
}
