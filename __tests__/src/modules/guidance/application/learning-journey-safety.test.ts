import { describe, expect, it } from 'vitest';

import { HINT_LEVELS } from '@modules/guidance/domain/models/hint-level';

import { ASSIGNMENT, ASSIGNMENT_TEXT, OTHER_CHILD, OWN_CHILD, SOLUTION_KEY } from '../fakes';
import { journeyApp } from '../journey-app';

import type { OutputMode } from '../journey-app';

const LOGIN = { email: 'journey-parent@example.org', password: 'synthetic-test-password' };
const OWN_TASK = 'Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?';
const REPLY = 'Ich habe addiert, weil noch Äpfel dazukommen.';

// These are application integration tests, not a substitute for browser/auth-cookie/SQL E2E (#18).
describe('complete learning journey across real use cases (#18)', () => {
  it.each(['own task', 'teacher assignment'])(
    '%s: all rungs, wrong/right, re-login and completion',
    async (source) => {
      const app = journeyApp();
      let run = app.connect();
      const child = { childProfileId: OWN_CHILD };
      expect((await run.open.execute(child))._unsafeUnwrapErr().kind).toBe('unauthorized');
      (await app.signIn.execute(LOGIN))._unsafeUnwrap();

      const input = {
        ...child,
        subject: 'math',
        ...(source === 'own task' ? { task: OWN_TASK } : { assignmentId: ASSIGNMENT }),
      };
      const started = (await run.start.execute(input))._unsafeUnwrap();
      const sessionId = started.session.sessionId;
      const step = { ...child, sessionId };
      const displayed: unknown[] = [started];
      expect(started.session.task).toBe(source === 'own task' ? OWN_TASK : ASSIGNMENT_TEXT);

      for (const [index, level] of HINT_LEVELS.entries()) {
        const hint = (
          await run.hint.execute({ ...step, requestId: `hint-${index}` })
        )._unsafeUnwrap();
        expect(hint.hint).toMatchObject({ kind: 'generated', level });
        displayed.push(hint);
      }
      const snapshot = structuredClone([...app.store.sessions.values()]);
      await run.hint.execute({ ...step, requestId: 'hint-3' });
      expect([...app.store.sessions.values()]).toEqual(snapshot);

      const wrong = (
        await run.check.execute({ ...step, requestId: 'wrong', answer: '6' })
      )._unsafeUnwrap();
      expect(wrong).toMatchObject({ result: 'not_yet', next: 'hint_ladder' });
      displayed.push(wrong);
      const wrongSnapshot = structuredClone([...app.store.sessions.values()]);
      await run.check.execute({ ...step, requestId: 'wrong', answer: '6' });
      expect([...app.store.sessions.values()]).toEqual(wrongSnapshot);

      app.signOut();
      run = app.connect();
      expect((await run.open.execute(child))._unsafeUnwrapErr().kind).toBe('unauthorized');
      (await app.signIn.execute(LOGIN))._unsafeUnwrap();
      const resumed = (await run.open.execute(child))._unsafeUnwrap();
      expect(resumed).toMatchObject({ sessionId, hintLevel: 'similar_example', status: 'working' });
      expect(resumed?.hints.map((hint) => hint.level)).toEqual(HINT_LEVELS);
      expect(resumed?.answerChecks).toHaveLength(1);
      expect((await run.start.execute(input))._unsafeUnwrap().outcome).toBe('continued');
      expect(app.store.starts).toHaveLength(1);

      const right = (
        await run.check.execute({
          ...step,
          requestId: 'right',
          answer: source === 'own task' ? '7' : SOLUTION_KEY,
        })
      )._unsafeUnwrap();
      expect(right).toMatchObject({
        result: 'correct',
        next: 'comprehension_question',
        praise: { kind: 'generated', text: 'Gut überlegt!' },
        question: { kind: 'generated', text: 'Warum hast du hier addiert?' },
      });
      displayed.push(right);
      run = app.connect();
      expect((await run.open.execute(child))._unsafeUnwrap()).toMatchObject({
        sessionId,
        status: 'awaiting_comprehension_reply',
        openQuestion: { text: 'Warum hast du hier addiert?' },
      });
      expect((await run.reply.execute({ ...step, reply: REPLY }))._unsafeUnwrap()).toEqual({
        sessionId,
        status: 'understood',
      });
      expect(app.store.replies).toEqual([{ completes: true, text: REPLY }]);
      expect((await run.open.execute(child))._unsafeUnwrap()).toBeNull();
      expect(app.store.sessions.get(sessionId)?.status).toBe('completed');

      // No response/continuation DTO or provider request receives the teacher's server-side key.
      expect(JSON.stringify(displayed)).not.toContain(SOLUTION_KEY);
      expect(JSON.stringify(app.requests)).not.toContain('solutionKey');
      expect(
        JSON.stringify(app.requests.filter((request) => !('answer' in request))),
      ).not.toContain(SOLUTION_KEY);
      for (const response of displayed) {
        expect(JSON.stringify(response)).not.toMatch(
          /Die Lösung ist|Richtig wäre|"text":"[^"]*\b(?:7|83)\b/,
        );
      }
    },
  );

  it.each<OutputMode>(['invalid', 'leaking'])(
    'rejects %s provider output through the complete hint/check/store chain',
    async (mode) => {
      const app = journeyApp(mode);
      (await app.signIn.execute(LOGIN))._unsafeUnwrap();
      const run = app.connect();
      const child = { childProfileId: OWN_CHILD };
      const started = (
        await run.start.execute({ ...child, assignmentId: ASSIGNMENT, subject: 'math' })
      )._unsafeUnwrap();
      const step = { ...child, sessionId: started.session.sessionId };
      const reason = mode === 'invalid' ? 'invalid_output' : 'solution_leaked';
      for (const [index, level] of HINT_LEVELS.entries()) {
        expect(
          (await run.hint.execute({ ...step, requestId: `hint-${index}` }))._unsafeUnwrap().hint,
        ).toMatchObject({ kind: 'fallback', level, reason });
      }
      const checked = (
        await run.check.execute({ ...step, answer: SOLUTION_KEY, requestId: 'right' })
      )._unsafeUnwrap();
      expect(checked).toMatchObject({
        result: 'correct',
        praise:
          mode === 'invalid'
            ? { kind: 'predefined', reason }
            : { kind: 'generated', text: 'Gut überlegt!' },
        question: { kind: 'predefined', reason },
      });
      const resumed = (await app.connect().open.execute(child))._unsafeUnwrap();
      expect(resumed?.openQuestion).toMatchObject({ kind: 'predefined' });
      expect(JSON.stringify(resumed)).not.toContain(SOLUTION_KEY);
      expect(JSON.stringify([...app.store.sessions.values()])).not.toContain('Die Lösung ist');
      expect(
        run.events.filter((event) => event.type === 'guidance.hint_fallback_used'),
      ).toHaveLength(4);
      expect(
        run.events.filter((event) => event.type === 'guidance.feedback_fallback_used'),
      ).toHaveLength(mode === 'invalid' ? 2 : 1);
      expect((await run.reply.execute({ ...step, reply: REPLY }))._unsafeUnwrap().status).toBe(
        'understood',
      );
    },
  );

  it('denies another child every step and leaves the real journey unchanged', async () => {
    const app = journeyApp();
    (await app.signIn.execute(LOGIN))._unsafeUnwrap();
    const run = app.connect();
    const started = (
      await run.start.execute({ childProfileId: OWN_CHILD, task: OWN_TASK, subject: 'math' })
    )._unsafeUnwrap();
    const before = structuredClone([...app.store.sessions.values()]);
    const foreign = {
      childProfileId: OTHER_CHILD,
      sessionId: started.session.sessionId,
      requestId: 'attack',
    };
    const denied = await Promise.all([
      run.start.execute({ ...foreign, task: OWN_TASK, subject: 'math' }),
      run.open.execute(foreign),
      run.hint.execute(foreign),
      run.check.execute({ ...foreign, answer: '7' }),
      run.reply.execute({ ...foreign, reply: REPLY }),
    ]);
    expect(denied.every((result) => result.isErr())).toBe(true);
    expect([...app.store.sessions.values()]).toEqual(before);
    expect(app.requests).toEqual([]);
  });
});
