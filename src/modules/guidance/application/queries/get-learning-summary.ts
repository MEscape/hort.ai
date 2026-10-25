import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import {
  SUMMARY_SESSION_LIMIT,
  summarizeLearning,
  summarySince,
} from '../../domain/insights/learning-summary';
import { parseChildProfileId } from '../../domain/models/ids';
import { INSIGHT_READ_BOUNDS } from '../guidance-limits';

import type { GetLearningSummaryInput } from '../contracts/insight-inputs';
import type { LearningSummaryView } from '../contracts/insight-views';
import type { InsightDependencies } from '../insight-dependencies';

export type GetLearningSummaryError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The parent's short summary of where their child needed help (#35): the last 14 days, at most ten
 * sessions. The learner module confirms the child is the parent's own and whether learning notes are
 * on; with them off nothing is read. Topics are named by the teacher's title or the curriculum,
 * never by the child's text.
 */
export class GetLearningSummary {
  constructor(private readonly deps: InsightDependencies) {}

  execute(
    input: GetLearningSummaryInput,
  ): AppResultAsync<LearningSummaryView, GetLearningSummaryError> {
    const { authorization, consent, records, assignments, competencies, clock } = this.deps;
    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId).asyncAndThen((childProfileId) =>
        consent.isEnabled(childProfileId).andThen((enabled) => {
          if (!enabled) {
            return okAsync<LearningSummaryView>({ kind: 'off' });
          }
          const owner = { tenantId: actor.tenantId, ownerId: actor.id };
          return records
            .listChildSessions(owner, childProfileId, summarySince(clock.now()), {
              ...INSIGHT_READ_BOUNDS,
              sessions: SUMMARY_SESSION_LIMIT,
            })
            .andThen((sessions) => {
              const codes = unique(sessions.flatMap(({ competencyCode }) => competencyCode ?? []));
              const hasAssignment = sessions.some(({ assignmentId }) => assignmentId !== null);
              return (
                hasAssignment
                  ? assignments.titlesForChild(childProfileId)
                  : okAsync(new Map<string, string>())
              ).andThen((assignmentTitles) =>
                (codes.length === 0
                  ? okAsync(new Map<string, string>())
                  : competencies.describe(codes)
                ).map((competencyTexts): LearningSummaryView => ({
                  kind: 'on',
                  summary: summarizeLearning(sessions, { assignmentTitles, competencyTexts }),
                })),
              );
            });
        }),
      ),
    );
  }
}
