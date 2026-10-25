import { toActorId, toTenantId } from '@modules/auth';
import { parseChildTaskText } from '@modules/guidance/domain/models/child-task-text';
import type { ChildTaskText } from '@modules/guidance/domain/models/child-task-text';
import type {
  FeedbackKind,
  FeedbackRequest,
} from '@modules/guidance/domain/models/feedback-request';
import type {
  GivenHint,
  HintLadderState,
} from '@modules/guidance/domain/models/help-session-state';
import type { HintRequest } from '@modules/guidance/domain/models/hint-request';
import {
  toAssignmentId,
  toChildProfileId,
  toHelpSessionId,
} from '@modules/guidance/domain/models/ids';
import type { AssignmentId, ChildProfileId } from '@modules/guidance/domain/models/ids';
import type {
  AssignmentAccess,
  AssignmentTask,
} from '@modules/guidance/domain/ports/assignment-access.port';
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
import type {
  HelpSessionRef,
  HintSessionStore,
  RecordedAnswerCheck,
} from '@modules/guidance/domain/ports/hint-session-store.port';
import type {
  SafetyClassifier,
  SafetyScores,
} from '@modules/guidance/domain/ports/safety-classifier.port';

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

/** A stand-in for the safety classifier: it scores as scripted and keeps the texts it rated. */
export function fakeSafetyClassifier(
  script: { readonly scores: SafetyScores } | { readonly fails: true },
) {
  const texts: string[] = [];
  const safety: SafetyClassifier = {
    classify(text) {
      texts.push(text);
      return 'fails' in script ? errAsync({ kind: 'timeout' }) : okAsync(script.scores);
    },
  };
  return { safety, texts };
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

export const ASSIGNMENT = toAssignmentId('assignment-1');
export const OTHER_CLASS_ASSIGNMENT = toAssignmentId('assignment-of-another-class');
export const ASSIGNMENT_TEXT = 'Rechne 36 + 47 und schreibe deinen Rechenweg auf.';
export const SOLUTION_KEY = '83';

/**
 * The assignments of the own child's class, as the assignments module answers: any other id (another
 * class's, a deleted one) and any other child is "not found". `fails` makes every lookup fail as an
 * unreachable store would. It keeps every lookup.
 */
export function fakeAssignments(
  options: {
    readonly assignments?: readonly AssignmentTask[];
    readonly childProfileId?: ChildProfileId;
    readonly fails?: boolean;
  } = {},
) {
  const {
    assignments = [{ id: ASSIGNMENT, text: ASSIGNMENT_TEXT, solutionKey: SOLUTION_KEY }],
    childProfileId = OWN_CHILD,
  } = options;
  const lookups: Array<{ readonly childProfileId: ChildProfileId; readonly id: AssignmentId }> = [];
  const access: AssignmentAccess = {
    findForChild(child, id) {
      lookups.push({ childProfileId: child, id });
      if (options.fails === true) {
        return errAsync(
          infrastructureError('assignments.persistence_failed', 'The assignments are unreachable.'),
        );
      }
      const found = child === childProfileId ? assignments.find((a) => a.id === id) : undefined;
      return found === undefined
        ? errAsync(notFoundError('guidance.assignment_not_found', 'The assignment was not found.'))
        : okAsync(found);
    },
  };
  return { access, lookups };
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

export const SESSION = toHelpSessionId('session-1');

const sessionKey = (ref: HelpSessionRef) =>
  [ref.tenantId, ref.ownerId, ref.childProfileId, ref.sessionId].join(':');

/** A help session of the default parent's own child, as the session storage would hold it. */
export function openSession(
  overrides: Partial<HintLadderState> & {
    readonly childProfileId?: ChildProfileId;
    readonly sessionId?: string;
  } = {},
) {
  const { childProfileId = OWN_CHILD, sessionId = SESSION, ...state } = overrides;
  return {
    ref: {
      tenantId: toTenantId('default'),
      ownerId: toActorId('parent-1'),
      childProfileId,
      sessionId: toHelpSessionId(sessionId),
    } satisfies HelpSessionRef,
    state: {
      task: REQUEST.task,
      assignmentId: null,
      subject: 'math',
      hints: [],
      answers: [],
      ...state,
    } satisfies HintLadderState,
  };
}

/**
 * An in-memory session storage: only a session it was given, for exactly that tenant, parent and
 * child, is found. It stores each request id once, as the database's unique key does, and keeps
 * every answer check. `failsRecording` makes every write fail as an unreachable store would.
 */
export function fakeSessionStore(
  sessions: ReadonlyArray<ReturnType<typeof openSession>> = [openSession()],
  options: { readonly failsRecording?: boolean } = {},
) {
  const stored = new Map(
    sessions.map(({ ref, state }) => [
      sessionKey(ref),
      { ...state, hints: [...state.hints], answers: [...state.answers] },
    ]),
  );
  const checks: RecordedAnswerCheck[] = [];
  const missing = () =>
    errAsync(notFoundError('guidance.session_not_found', 'The help session was not found.'));
  const writeFailed = () =>
    errAsync(infrastructureError('guidance.session_store_failed', 'The session store is down.'));
  const store: HintSessionStore = {
    load(ref) {
      const session = stored.get(sessionKey(ref));
      return session === undefined
        ? missing()
        : okAsync({ ...session, hints: [...session.hints], answers: [...session.answers] });
    },
    recordHint(ref, hint: GivenHint) {
      const session = stored.get(sessionKey(ref));
      if (options.failsRecording) {
        return writeFailed();
      }
      if (session === undefined) {
        return missing();
      }
      if (session.hints.some((h) => h.requestId === hint.requestId)) {
        return okAsync('duplicate');
      }
      session.hints.push(hint);
      return okAsync('recorded');
    },
    recordAnswerCheck(ref, check) {
      const session = stored.get(sessionKey(ref));
      if (options.failsRecording) {
        return writeFailed();
      }
      if (session === undefined) {
        return missing();
      }
      if (checks.some((c) => c.requestId === check.requestId)) {
        return okAsync('duplicate');
      }
      checks.push(check);
      session.answers.push(check.result);
      return okAsync('recorded');
    },
  };
  return {
    store,
    checks,
    hintsOf: (ref = openSession().ref) => stored.get(sessionKey(ref))?.hints ?? [],
  };
}
