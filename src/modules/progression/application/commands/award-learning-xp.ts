import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  PROGRESSION_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/progression-errors';
import {
  LEARNING_EVENT_XP,
  isLearningEventKey,
  isLearningEventKind,
  learningEventKey,
} from '../../domain/models/xp-rules';
import { grantXp } from '../services/grant-xp';
import { loadAuthorizedChild } from '../services/load-authorized-child';

import type { AwardLearningXpInput } from '../contracts/progression-inputs';
import type { AwardLearningXpView } from '../contracts/progression-views';
import type { ProgressionDependencies } from '../progression-dependencies';
import type { LoadChildError } from '../services/load-authorized-child';

export type AwardLearningXpError = LoadChildError;

/** Both fields come from a caller: a kind outside the table or a malformed key stores nothing. */
function checkInput(event: string, eventKey: string): AppResult<null, ValidationAppError> {
  if (!isLearningEventKind(event)) {
    return err(fieldValidationFailed('event', PROGRESSION_VALIDATION_CODES.eventInvalid));
  }
  return isLearningEventKey(eventKey)
    ? ok(null)
    : err(fieldValidationFailed('eventKey', PROGRESSION_VALIDATION_CODES.eventKeyInvalid));
}

/**
 * The idempotent entry point for XP from confirmed learning events (help sessions come with #34;
 * nothing calls it yet). The event KIND picks the amount from the closed rules table: no number
 * from the caller and no AI text is ever involved. The same `eventKey` rewards once, whatever the
 * interleaving. Audited only when something was stored.
 */
export class AwardLearningXp {
  constructor(private readonly deps: ProgressionDependencies) {}

  execute(input: AwardLearningXpInput): AppResultAsync<AwardLearningXpView, AwardLearningXpError> {
    const { audit, clock } = this.deps;
    const { event, eventKey } = input;

    return loadAuthorizedChild(this.deps, input.childProfileId, 'progression.update').andThen(
      ({ actor, childProfileId }) =>
        checkInput(event, eventKey).asyncAndThen(() =>
          grantXp(
            this.deps,
            { actor, childProfileId, now: clock.now() },
            {
              kind: 'learning',
              eventKey: learningEventKey(eventKey),
              xp: LEARNING_EVENT_XP[event],
            },
          ).map(({ stored, leveledUp, progress }): AwardLearningXpView => {
            if (stored) {
              audit.record({
                type: 'progression.xp_awarded',
                actorId: actor.id,
                tenantId: actor.tenantId,
                childProfileId,
                event,
                xp: LEARNING_EVENT_XP[event],
                level: progress.level,
              });
            }
            return { outcome: stored ? 'granted' : 'duplicate', leveledUp, progress };
          }),
        ),
    );
  }
}
