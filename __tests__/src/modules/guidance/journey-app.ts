import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import { SignIn } from '@modules/auth/application/commands/sign-in';
import { unauthenticated } from '@modules/auth/domain/errors/auth-errors';
import type { Actor } from '@modules/auth/domain/models/actor';
import { CheckAnswer } from '@modules/guidance/application/commands/check-answer';
import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetOpenHelpSession } from '@modules/guidance/application/queries/get-open-help-session';
import { AnswerCoach } from '@modules/guidance/application/services/answer-coach';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import type { FeedbackRequest } from '@modules/guidance/domain/models/feedback-request';
import type { HintRequest } from '@modules/guidance/domain/models/hint-request';
import type { FeedbackProvider } from '@modules/guidance/domain/ports/feedback-provider.port';
import type { HintProvider } from '@modules/guidance/domain/ports/hint-provider.port';

import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../support/rate-limiting';
import { clientAt, fakeAuthenticator, parent, recordingAudit } from '../auth/fakes';

import { fakeAssignments } from './fakes';
import { helpSessionDependencies, inMemorySessions } from './help-session-fakes';

export type OutputMode = 'valid' | 'invalid' | 'leaking';

function fakeWording(mode: OutputMode, kind: FeedbackRequest['kind']) {
  if (mode === 'leaking' && kind !== 'praise') {
    return 'Schreib: 83. Warum ist das so?';
  }
  return kind === 'praise' ? 'Gut überlegt!' : 'Warum hast du hier addiert?';
}

/** Real use cases over port fakes, with a fresh composition sharing only the persisted store. */
export function journeyApp(mode: OutputMode = 'valid') {
  const store = inMemorySessions();
  const requests: Array<HintRequest | FeedbackRequest> = [];
  const assignments = fakeAssignments();
  const rateLimiter = createTestRateLimiter();
  let actor: Actor | null = null;
  const authenticator = fakeAuthenticator();
  const signIn = new SignIn({
    authenticator: {
      ...authenticator,
      signIn: (credentials) =>
        authenticator.signIn(credentials).map(() => {
          actor = parent();
        }),
    },
    rateLimiter,
    clientAddress: clientAt('203.0.113.18'),
    audit: recordingAudit(),
  });
  const ai: HintProvider & FeedbackProvider = {
    suggest(request) {
      requests.push(request);
      return okAsync(
        mode === 'invalid'
          ? { unexpected: true }
          : {
              version: 1,
              kind: 'hint',
              hintLevel: request.level,
              text: mode === 'leaking' ? 'Die Lösung ist 83.' : 'Was ist in der Aufgabe gesucht?',
            },
      );
    },
    word(request) {
      requests.push(request);
      return okAsync(
        mode === 'invalid'
          ? { unexpected: true }
          : {
              version: 1,
              kind: request.kind,
              hintLevel: request.level,
              text: fakeWording(mode, request.kind),
              ...(request.kind === 'answer_assessment'
                ? { result: request.answer === '7' ? 'correct' : 'not_yet' }
                : {}),
            },
      );
    },
  };

  function connect() {
    const { deps, events } = helpSessionDependencies(
      store.repository,
      parent(),
      rateLimiter,
      assignments,
    );
    const current = {
      ...deps,
      authorization: createAuthorizationService({
        currentActor: {
          getCurrentActor: () => (actor === null ? errAsync(unauthenticated()) : okAsync(actor)),
        },
        audit: recordingAudit(),
      }),
    };
    return {
      start: new StartHelpSession(current),
      open: new GetOpenHelpSession(current),
      hint: new RequestHint({
        ...current,
        hints: new HintOrchestrator({ provider: ai, audit: deps.audit }),
      }),
      check: new CheckAnswer({
        ...current,
        answers: new AnswerCoach({ provider: ai, audit: deps.audit }),
      }),
      reply: new ReplyToComprehensionQuestion(current),
      events,
    };
  }
  return {
    store,
    requests,
    signIn,
    connect,
    signOut: () => {
      actor = null;
    },
  };
}
