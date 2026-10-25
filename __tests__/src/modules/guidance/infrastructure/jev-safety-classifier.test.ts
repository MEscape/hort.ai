import { describe, expect, it } from 'vitest';

import { JevSafetyClassifier } from '@modules/guidance/infrastructure/typesafe/jev-safety-classifier';

const API_KEY = 'typesafe-test-key-0123456789';
const TEXT = 'Was passiert mit der Zahl der Äpfel?';

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
  readonly body: string;
}

/** A `fetch` that answers from a script, one reply per call, and records every call. */
function scriptedFetch(...replies: Array<Response | Error>) {
  const calls: RecordedCall[] = [];
  const send = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      init: init ?? {},
      body: typeof init?.body === 'string' ? init.body : '',
    });
    const reply = replies.shift();
    if (reply === undefined) {
      return Promise.reject(new Error('no scripted reply left'));
    }
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  };
  return { fetch: send, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const noul = (value: number) => ({ type: 'noul', noul: value });

function classifier(fetch: typeof globalThis.fetch, apiUrl = 'https://api.typesafe.ai') {
  return new JevSafetyClassifier({
    apiKey: API_KEY,
    apiUrl,
    modelId: 'jev-1.14.0',
    timeoutMs: 1000,
    fetch,
  });
}

describe('JevSafetyClassifier', () => {
  it('asks one yes/no question per rule, with the text as the state only', async () => {
    const { fetch, calls } = scriptedFetch(
      json({
        model: 'jev-1.14.0',
        answers: {
          personal_data: noul(0.01),
          secrecy: noul(0.02),
          inappropriate: noul(0.03),
          discouraging: noul(0.9),
        },
        usage: { input_tokens: 300, output_tokens: 40 },
      }),
    );

    const scores = await classifier(fetch).classify(TEXT);

    expect(scores._unsafeUnwrap()).toEqual({
      'guidance.child_safety.asks_for_personal_data': 0.01,
      'guidance.child_safety.asks_for_secrecy': 0.02,
      'guidance.child_safety.inappropriate_content': 0.03,
      'guidance.child_safety.discouraging': 0.9,
    });
    expect(calls[0]?.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${API_KEY}` });
    const body = JSON.parse(calls[0]?.body ?? '') as {
      model: string;
      state: string;
      questions: Record<string, { type: string; instructions: string }>;
    };
    expect(body.model).toBe('jev-1.14.0');
    expect(body.state).toBe(TEXT);
    expect(Object.keys(body.questions)).toEqual([
      'personal_data',
      'secrecy',
      'inappropriate',
      'discouraging',
    ]);
    expect(Object.values(body.questions).every((q) => q.type === 'noul')).toBe(true);
    expect(JSON.stringify(body.questions)).not.toContain(TEXT);
  });

  it('counts a rule Jev did not answer, or answered oddly, as flagged', async () => {
    const { fetch } = scriptedFetch(
      json({ answers: { personal_data: noul(0), secrecy: { type: 'noul' }, inappropriate: 'x' } }),
    );

    const scores = (
      await classifier(fetch, 'http://localhost:9002/').classify(TEXT)
    )._unsafeUnwrap();

    expect(scores).toEqual({
      'guidance.child_safety.asks_for_personal_data': 0,
      'guidance.child_safety.asks_for_secrecy': 1,
      'guidance.child_safety.inappropriate_content': 1,
      'guidance.child_safety.discouraging': 1,
    });
  });

  it('reports an unknown shape and a refused call as unavailable, with the status only', async () => {
    const { fetch } = scriptedFetch(json({ answers: [] }), json({ error: TEXT }, 429));
    const jev = classifier(fetch);

    expect((await jev.classify(TEXT))._unsafeUnwrapErr().kind).toBe('unavailable');
    const refused = (await jev.classify(TEXT))._unsafeUnwrapErr();
    const cause = String(refused.kind === 'unavailable' && refused.cause);
    expect(cause).toContain('429');
    expect(cause).not.toContain('Äpfel');
    expect(cause).not.toContain(API_KEY);
  });

  it('reports a missed deadline as timeout and a broken connection by its name only', async () => {
    const { fetch } = scriptedFetch(
      new DOMException('The operation timed out.', 'TimeoutError'),
      new TypeError(TEXT),
      Object.assign(new Error(), { name: '' }),
    );
    const jev = classifier(fetch);

    expect((await jev.classify(TEXT))._unsafeUnwrapErr()).toEqual({ kind: 'timeout' });
    const broken = (await jev.classify(TEXT))._unsafeUnwrapErr();
    expect(broken.kind === 'unavailable' && String(broken.cause)).toContain('TypeError');
    expect(broken.kind === 'unavailable' && String(broken.cause)).not.toContain('Äpfel');
    expect((await jev.classify(TEXT))._unsafeUnwrapErr().kind).toBe('unavailable');
  });
});
