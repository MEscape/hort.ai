import { infrastructureError } from '@lib/errors';
import { fromThrowableAsync, ResultAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { parseTutorId } from '../../domain/models/ids';

import { guidanceChildLearning } from './guidance-child-learning';

import type { ChannelRunner } from './guidance-child-learning';
import type { TutorId } from '../../domain/models/ids';
import type { ChildCompanion, ChildHome } from '../../domain/ports/child-companion.port';

/** How audit events name this channel when it acts for the guardian. */
const ALEXA_CHANNEL = 'alexa';

/** Server configuration of the demo coupling; never anything from a request. */
export interface DemoChildBinding {
  readonly guardianId: string;
  readonly childProfileId: string;
  /** Catalog ids of the ready tutors: a profile's `tutorId` outside them speaks as no companion. */
  readonly readyTutors: readonly TutorId[];
  readonly now: () => Date;
}

/**
 * The child-app use cases for the ONE configured child, each run as the child channel of its guardian
 * (auth's `runAsChildChannel`), so the use cases authorize every call as they do for the web, and auth
 * keeps the channel to this one child and to the child-side permissions (no sibling, no parent operation,
 * no learning XP; only the daily reward and the help session's steps are written). The modules are
 * loaded on the first call, not with the route, so request verification stays cheap.
 */
export function demoChildCompanion(binding: DemoChildBinding): ChildCompanion {
  const { childProfileId } = binding;
  const inChannel = channelRunner({
    channel: ALEXA_CHANNEL,
    guardianId: binding.guardianId,
    childProfileId,
  });
  return {
    ...guidanceChildLearning(inChannel, childProfileId),
    companion: () =>
      inChannel(async () => {
        const { getLearnerQueries } = await import('@modules/learner');
        return getLearnerQueries()
          .getChildProfileById.execute(childProfileId)
          .map((profile) => readyTutor(profile.tutorId, binding.readyTutors));
      }),
    home: () =>
      inChannel(async () => {
        const [
          { getLearnerQueries, isLearningAllowedNow },
          { getProgressionQueries },
          assignments,
        ] = await Promise.all([
          import('@modules/learner'),
          import('@modules/progression'),
          import('@modules/assignments'),
        ]);
        return ResultAsync.combine([
          getLearnerQueries().getChildProfileById.execute(childProfileId),
          getProgressionQueries().getProgress.execute({ childProfileId }),
          assignments.assignmentsQueries.listChildAssignments.execute(childProfileId),
        ] as const).map(([profile, progress, tasks]): ChildHome => ({
          tutorId: readyTutor(profile.tutorId, binding.readyTutors),
          learningAllowed: isLearningAllowedNow(profile.controls, binding.now()),
          rewardAvailable: progress.dailyReward.status === 'available',
          mood: progress.mood,
          openTasks: tasks.length,
        }));
      }),
    feed: () =>
      inChannel(async () => {
        const { getProgressionCommands } = await import('@modules/progression');
        return getProgressionCommands()
          .claimDailyReward.execute({ childProfileId })
          .map(({ outcome, leveledUp, progress }) => ({
            outcome,
            stars: progress.dailyReward.xp,
            leveledUp,
            level: progress.level,
          }));
      }),
    level: () =>
      inChannel(async () => {
        const { getProgressionQueries } = await import('@modules/progression');
        return getProgressionQueries()
          .getProgress.execute({ childProfileId })
          .map((progress) => ({
            level: progress.level,
            starsToNext:
              progress.xpForNextLevel === null || progress.level >= progress.maxLevel
                ? null
                : Math.max(progress.xpForNextLevel - progress.xpIntoLevel, 0),
          }));
      }),
    tasks: () =>
      inChannel(async () => {
        const [{ classroomQueries }, { assignmentsQueries }] = await Promise.all([
          import('@modules/classroom'),
          import('@modules/assignments'),
        ]);
        return ResultAsync.combine([
          classroomQueries.getChildClassroom.execute(childProfileId),
          assignmentsQueries.listChildAssignments.execute(childProfileId),
        ] as const).map(([classroom, tasks]) => ({
          inClass: classroom !== null,
          titles: tasks.map((task) => task.title),
        }));
      }),
  };
}

/** Runs one use-case call inside the child channel scope; a failed module load is an infrastructure error. */
function channelRunner(channel: {
  readonly channel: string;
  readonly guardianId: string;
  readonly childProfileId: string;
}): ChannelRunner {
  // An async `work` resolves the use case's ResultAsync to its Result inside the scope.
  return <T>(work: () => Promise<AppResult<T>>): AppResultAsync<T> =>
    fromThrowableAsync(
      async () => {
        const { runAsChildChannel } = await import('@modules/auth');
        return runAsChildChannel(channel, work);
      },
      (cause) => infrastructureError('alexa.child_unavailable', 'Child channel failed.', cause),
    ).andThen((result) => result);
}

function readyTutor(raw: string | null, ready: readonly TutorId[]): TutorId | null {
  if (raw === null) {
    return null;
  }
  const tutorId = parseTutorId(raw);
  return tutorId.isOk() && ready.includes(tutorId.value) ? tutorId.value : null;
}
