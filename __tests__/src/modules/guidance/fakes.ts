import { parseChildTaskText } from '@modules/guidance/domain/models/child-task-text';
import type { ChildTaskText } from '@modules/guidance/domain/models/child-task-text';
import type {
  FeedbackKind,
  FeedbackRequest,
} from '@modules/guidance/domain/models/feedback-request';
import type { HintRequest } from '@modules/guidance/domain/models/hint-request';
import { toChildProfileId } from '@modules/guidance/domain/models/ids';
import type { ChildProfileId } from '@modules/guidance/domain/models/ids';
import type { ChildProfileAccess } from '@modules/guidance/domain/ports/child-profile-access.port';
import type {
  CompetencyQuery,
  CompetencyRetrieval,
} from '@modules/guidance/domain/ports/competency-retrieval.port';
import type { FeedbackProvider } from '@modules/guidance/domain/ports/feedback-provider.port';
import type { GuidanceEvent } from '@modules/guidance/domain/ports/guidance-audit-log.port';
import type {
  HintProvider,
  HintProviderFailure,
} from '@modules/guidance/domain/ports/hint-provider.port';

import { infrastructureError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

/** A task text as the input check produces it; a test that needs another text goes through the same check. */
export function task(text: string): ChildTaskText {
  return parseChildTaskText(text)._unsafeUnwrap();
}

export const REQUEST: HintRequest = {
  task: task('Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?'),
  level: 'next_step',
  competencies: [{ code: 'M2.1', description: 'Addieren im Zahlenraum bis 20' }],
};

/** What the scripted provider does on its next call. */
export type ProviderScript =
  | { readonly answer: unknown }
  | { readonly failure: HintProviderFailure }
  | { readonly throws: true };

/** A deterministic stand-in for the AI model: it answers exactly as scripted and keeps what it was asked. */
export function fakeHintProvider(script: ProviderScript) {
  const requests: HintRequest[] = [];
  const provider: HintProvider = {
    suggest(request) {
      requests.push(request);
      if ('throws' in script) {
        throw new Error('provider exploded');
      }
      return 'failure' in script ? errAsync(script.failure) : okAsync(script.answer);
    },
  };
  return { provider, requests };
}

/** Keeps every event the orchestration logs, so a test can check what operations would see. */
export function recordingAuditLog() {
  const events: GuidanceEvent[] = [];
  return { audit: { record: (event: GuidanceEvent) => events.push(event) }, events };
}

export const OWN_CHILD = toChildProfileId('child-1');
export const OTHER_CHILD = toChildProfileId('child-of-someone-else');

/** The children the signed-in parent owns; any other id is "not found", as the learner module answers. */
export function ownChildren(owned: readonly ChildProfileId[] = [OWN_CHILD]): ChildProfileAccess {
  return {
    findOwn: (id) =>
      owned.includes(id)
        ? okAsync({ id, federalState: 'BY', grade: 2 })
        : errAsync(notFoundError('child_profile.not_found', 'The child profile was not found.')),
  };
}

/** Curriculum retrieval that returns REQUEST's competencies, or fails when `fails`; it keeps every query. */
export function fakeCompetencies(options: { readonly fails?: boolean } = {}) {
  const queries: CompetencyQuery[] = [];
  const retrieval: CompetencyRetrieval = {
    findFor(query) {
      queries.push(query);
      return options.fails
        ? errAsync(
            infrastructureError('curriculum.infrastructure', 'The curriculum is unreachable.'),
          )
        : okAsync(REQUEST.competencies);
    },
  };
  return { retrieval, queries };
}

/** What the scripted feedback provider answers, per kind; a kind without a script is unavailable. */
export type FeedbackScripts = Partial<Record<FeedbackKind, ProviderScript>>;

/** A deterministic stand-in for the AI's feedback: it answers each kind as scripted and keeps every request. */
export function fakeFeedbackProvider(scripts: FeedbackScripts) {
  const requests: FeedbackRequest[] = [];
  const provider: FeedbackProvider = {
    word(request) {
      requests.push(request);
      const script = scripts[request.kind] ?? { failure: { kind: 'unavailable' } };
      if ('throws' in script) {
        throw new Error('provider exploded');
      }
      return 'failure' in script ? errAsync(script.failure) : okAsync(script.answer);
    },
  };
  return { provider, requests };
}
