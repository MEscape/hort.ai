import { describe, expect, it } from 'vitest';

import { JevTopicClassifier } from '@modules/guidance/infrastructure/typesafe/jev-topic-classifier';

import { task } from '../fakes';

const API_KEY = 'typesafe-test-key-0123456789';
const TASK = task('Tim verteilt 12 Äpfel gerecht an 3 Kinder. Wie viele bekommt jedes?');
const CANDIDATES = [
  { code: 'he-kc-mathematik-primarstufe@2011:s2-3', description: 'addieren und subtrahieren' },
  { code: 'he-kc-mathematik-primarstufe@2011:s2-4', description: 'gerecht verteilen (Division)' },
];

/** A `fetch` that answers from a script, one reply per call, and records every request body. */
function scriptedFetch(...replies: Array<Response | Error>) {
  const bodies: string[] = [];
  const send = (_: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    bodies.push(typeof init?.body === 'string' ? init.body : '');
    const reply = replies.shift();
    if (reply === undefined) {
      return Promise.reject(new Error('no scripted reply left'));
    }
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  };
  return { fetch: send, bodies };
}

const answered = (answers: Record<string, unknown>) =>
  new Response(JSON.stringify({ model: 'jev-1.14.0', answers }), { status: 200 });
const noul = (value: number) => ({ type: 'noul', noul: value });

function classify(fetch: typeof globalThis.fetch, candidates = CANDIDATES) {
  return new JevTopicClassifier({
    apiKey: API_KEY,
    apiUrl: 'https://api.typesafe.ai',
    modelId: 'jev-1.14.0',
    timeoutMs: 1000,
    fetch,
  }).classify({ task: TASK, subject: 'math', candidates });
}

describe('JevTopicClassifier', () => {
  it('asks fixed questions, with the child text and the candidates in the state only', async () => {
    const { fetch, bodies } = scriptedFetch(answered({}));

    await classify(fetch);

    const body = JSON.parse(bodies[0] ?? '') as {
      state: string;
      questions: Record<string, { type: string; instructions: string }>;
    };
    expect(JSON.parse(body.state)).toEqual({
      message: TASK,
      candidates: [
        { number: 1, description: 'addieren und subtrahieren' },
        { number: 2, description: 'gerecht verteilen (Division)' },
      ],
    });
    expect(Object.keys(body.questions)).toEqual([
      'intent_homework',
      'intent_curiosity',
      'intent_small_talk',
      'subject_math',
      'subject_german',
      'subject_general_studies',
      'subject_english',
      'candidate_1',
      'candidate_2',
    ]);
    const questions = JSON.stringify(body.questions);
    expect(questions).not.toContain('Äpfel');
    expect(questions).not.toContain('Division');
    expect(questions).not.toContain('s2-4');
  });

  it('builds the classification from the best scores', async () => {
    const { fetch } = scriptedFetch(
      answered({
        intent_homework: noul(0.94),
        intent_curiosity: noul(0.1),
        intent_small_talk: noul(0.02),
        subject_math: noul(0.97),
        subject_german: noul(0.05),
        candidate_1: noul(0.2),
        candidate_2: noul(0.81),
      }),
    );

    expect((await classify(fetch))._unsafeUnwrap()).toEqual({
      version: 1,
      intent: { value: 'homework', confidence: 0.94 },
      subject: { value: 'math', confidence: 0.97 },
      topic: {
        kind: 'competency',
        competencyCode: 'he-kc-mathematik-primarstufe@2011:s2-4',
        confidence: 0.81,
      },
    });
  });

  it('counts a missing answer as 0, so nothing is guessed', async () => {
    const { fetch } = scriptedFetch(answered({ intent_curiosity: { type: 'noul' } }));

    expect((await classify(fetch))._unsafeUnwrap()).toEqual({
      version: 1,
      intent: { value: 'homework', confidence: 0 },
      subject: null,
      topic: { kind: 'none' },
    });
  });

  it('names no topic when there are no candidates', async () => {
    const { fetch } = scriptedFetch(answered({ intent_homework: noul(0.9) }));

    expect((await classify(fetch, []))._unsafeUnwrap()).toMatchObject({ topic: { kind: 'none' } });
  });

  it('gives a message that is not homework no topic', async () => {
    const { fetch } = scriptedFetch(
      answered({
        intent_homework: noul(0.1),
        intent_small_talk: noul(0.9),
        candidate_1: noul(0.9),
      }),
    );

    expect((await classify(fetch))._unsafeUnwrap()).toMatchObject({
      intent: { value: 'small_talk', confidence: 0.9 },
      topic: { kind: 'none' },
    });
  });

  it('passes a score that is not a probability on, for the validator to reject', async () => {
    const { fetch } = scriptedFetch(answered({ intent_homework: noul(1.7) }));

    expect((await classify(fetch))._unsafeUnwrap()).toMatchObject({
      intent: { value: 'homework', confidence: 1.7 },
    });
  });

  it('asks about at most five candidates', async () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      code: `material:x:s1-${index}`,
      description: `Kompetenz ${index}`,
    }));
    const { fetch, bodies } = scriptedFetch(answered({}));

    await classify(fetch, many);

    const body = JSON.parse(bodies[0] ?? '') as { questions: Record<string, unknown> };
    expect(Object.keys(body.questions).filter((key) => key.startsWith('candidate_'))).toHaveLength(
      5,
    );
  });

  it('reports a timeout as timeout and a refusal without the key or the text', async () => {
    const { fetch } = scriptedFetch(
      new DOMException('The operation timed out.', 'TimeoutError'),
      new Response(JSON.stringify({ error: TASK }), { status: 500 }),
    );

    expect((await classify(fetch))._unsafeUnwrapErr()).toEqual({ kind: 'timeout' });
    const refused = (await classify(fetch))._unsafeUnwrapErr();
    const cause = String(refused.kind === 'unavailable' && refused.cause);
    expect(cause).toContain('500');
    expect(cause).not.toContain('Äpfel');
    expect(cause).not.toContain(API_KEY);
  });
});
