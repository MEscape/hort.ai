import { describe, expect, it } from 'vitest';

import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { toStepRequestId } from '@modules/guidance/domain/models/ids';

import { OWN_CHILD, task } from '../fakes';
import { helpSessionDependencies, inMemorySessions, storedSession } from '../help-session-fakes';

const DISTRESS = 'Ich will nicht mehr leben.';
const CODE = 'guidance.child_safety.distress_signal';

describe('distress check on the child input (#90)', () => {
  it('refuses to start a session on a distress message, stores nothing and logs only the category', async () => {
    const store = inMemorySessions();
    const { deps, events } = helpSessionDependencies(store.repository);

    const result = await new StartHelpSession(deps).execute({
      childProfileId: OWN_CHILD,
      task: DISTRESS,
      subject: 'math',
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      code: CODE,
      fieldErrors: { task: [CODE] },
    });
    expect(store.starts).toEqual([]);
    expect(events).toEqual([
      { type: 'guidance.child_safety.distress_signal', category: 'self_harm', field: 'task' },
    ]);
    expect(JSON.stringify(result)).not.toContain('leben');
  });

  it('still starts an ordinary task that only sounds worried', async () => {
    const store = inMemorySessions();
    const { deps } = helpSessionDependencies(store.repository);

    const result = await new StartHelpSession(deps).execute({
      childProfileId: OWN_CHILD,
      task: 'Tim hat Angst vor dem Hund. Wie viele Beine haben 3 Hunde?',
      subject: 'math',
    });

    expect(result._unsafeUnwrap().outcome).toBe('started');
  });

  it('refuses a distress reply to the comprehension question without storing it', async () => {
    const store = inMemorySessions([
      storedSession({
        answerChecks: [
          {
            requestId: toStepRequestId('check-1'),
            answer: task('42'),
            result: 'correct',
            assessedBy: 'ai',
            hintLevel: 'next_step',
            feedbackText: null,
            question: { text: null, reply: null },
            occurredAt: new Date('2026-10-25T08:00:00.000Z'),
          },
        ],
      }),
    ]);
    const { deps, events } = helpSessionDependencies(store.repository);

    const result = await new ReplyToComprehensionQuestion(deps).execute({
      childProfileId: OWN_CHILD,
      sessionId: 'session-1',
      reply: 'Mein Papa schlägt mich.',
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: CODE, fieldErrors: { reply: [CODE] } });
    expect(store.replies).toEqual([]);
    expect(events).toEqual([
      {
        type: 'guidance.child_safety.distress_signal',
        category: 'violence_or_abuse',
        field: 'reply',
      },
    ]);
  });
});
