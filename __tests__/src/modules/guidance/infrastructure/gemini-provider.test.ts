import { describe, expect, it } from 'vitest';

import { buildFeedbackPrompt } from '@modules/guidance/domain/prompt/feedback-prompt';
import { buildHintPrompt } from '@modules/guidance/domain/prompt/hint-prompt';
import { GeminiProvider } from '@modules/guidance/infrastructure/gemini/gemini-provider';

import { REQUEST, task } from '../fakes';

const ANSWER = { version: 1, kind: 'hint', hintLevel: 'next_step', text: 'Was weißt du schon?' };
const FEEDBACK = { ...REQUEST, kind: 'answer_assessment' as const, answer: task('7') };
const API_KEY = 'gemini-test-key-0123456789';

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
  readonly body: string;
}

type Reply = Response | Error;

/** A `fetch` that answers from a script, one reply per call, and records every call. */
function scriptedFetch(...replies: Reply[]) {
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

const reply = (text: string) => json({ candidates: [{ content: { parts: [{ text }] } }] });

function provider(
  fetch: typeof globalThis.fetch,
  apiUrl = 'https://generativelanguage.googleapis.com',
) {
  return new GeminiProvider({
    apiKey: API_KEY,
    apiUrl,
    modelId: 'gemini-3.8-flash',
    timeoutMs: 1000,
    fetch,
  });
}

describe('GeminiProvider', () => {
  it('sends the instructions as the system instruction and the data as the only user message', async () => {
    const { fetch, calls } = scriptedFetch(reply(JSON.stringify(ANSWER)));

    const answer = await provider(fetch).suggest(REQUEST);

    expect(answer._unsafeUnwrap()).toEqual(ANSWER);
    const { instructions, data } = buildHintPrompt(REQUEST);
    expect(calls[0]?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    );
    expect(calls[0]?.url).not.toContain(API_KEY);
    expect(calls[0]?.init.headers).toMatchObject({ 'x-goog-api-key': API_KEY });
    const body = JSON.parse(calls[0]?.body ?? '') as Record<string, unknown>;
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: data }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });
    expect(body['safetySettings']).toHaveLength(4);
    expect(JSON.stringify(body['safetySettings'])).not.toContain('BLOCK_NONE');
  });

  it('words answer feedback with the feedback prompt, also behind an origin with a slash', async () => {
    const { fetch, calls } = scriptedFetch(reply('{"version":1}'));

    await provider(fetch, 'http://localhost:9001/').word(FEEDBACK);

    expect(calls[0]?.url).toBe(
      'http://localhost:9001/v1beta/models/gemini-3.8-flash:generateContent',
    );
    const body = JSON.parse(calls[0]?.body ?? '') as { contents: unknown };
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: buildFeedbackPrompt(FEEDBACK).data }] },
    ]);
  });

  it('joins split parts, passes non-JSON text on for the contract to reject, and has nothing for a blocked answer', async () => {
    const { fetch } = scriptedFetch(
      json({ candidates: [{ content: { parts: [{ text: '{"version":' }, { text: '1}' }, {}] } }] }),
      reply('Die Lösung ist 7.'),
      json({ candidates: [{ finishReason: 'SAFETY' }] }),
      json({ promptFeedback: { blockReason: 'SAFETY' } }),
      json({ candidates: 'odd' }),
    );
    const gemini = provider(fetch);

    expect((await gemini.suggest(REQUEST))._unsafeUnwrap()).toEqual({ version: 1 });
    expect((await gemini.suggest(REQUEST))._unsafeUnwrap()).toBe('Die Lösung ist 7.');
    expect((await gemini.suggest(REQUEST))._unsafeUnwrap()).toBeUndefined();
    expect((await gemini.suggest(REQUEST))._unsafeUnwrap()).toBeUndefined();
    expect((await gemini.suggest(REQUEST))._unsafeUnwrap()).toBeUndefined();
  });

  it('unwraps the one object from a code fence, a one-element array or surrounding prose', async () => {
    const assessment = { ...ANSWER, kind: 'answer_assessment', result: 'not_yet' };
    const text = JSON.stringify(assessment);
    const { fetch } = scriptedFetch(
      reply('```json\n' + text + '\n```'),
      reply('```\n' + text + '\n```\n'),
      reply(`[${text}]`),
      reply('```json\n[' + text + ']\n```'),
      reply(`Hier ist die Bewertung:\n${text}\nViel Erfolg!`),
    );
    const gemini = provider(fetch);

    for (let call = 0; call < 5; call += 1) {
      expect((await gemini.word(FEEDBACK))._unsafeUnwrap()).toEqual(assessment);
    }
  });

  it('leaves anything but exactly one object for the contract to reject', async () => {
    const one = JSON.stringify(ANSWER);
    const { fetch } = scriptedFetch(
      reply(`[${one}, ${one}]`),
      reply(`${one}\n${one}`),
      reply('```json\nDie Lösung ist 7.\n```'),
      reply('[]'),
      reply('"nur Text"'),
    );
    const gemini = provider(fetch);

    expect((await gemini.word(FEEDBACK))._unsafeUnwrap()).toEqual([ANSWER, ANSWER]);
    expect((await gemini.word(FEEDBACK))._unsafeUnwrap()).toBe(`${one}\n${one}`);
    expect((await gemini.word(FEEDBACK))._unsafeUnwrap()).toBe('```json\nDie Lösung ist 7.\n```');
    expect((await gemini.word(FEEDBACK))._unsafeUnwrap()).toEqual([]);
    expect((await gemini.word(FEEDBACK))._unsafeUnwrap()).toBe('nur Text');
  });

  it('reports a refused call with its status only, never the key or the error text', async () => {
    const { fetch } = scriptedFetch(json({ message: 'Lisa hat 3 Äpfel' }, 503));

    const failure = (await provider(fetch).suggest(REQUEST))._unsafeUnwrapErr();

    expect(failure.kind).toBe('unavailable');
    const cause = String(failure.kind === 'unavailable' && failure.cause);
    expect(cause).toContain('503');
    expect(cause).not.toContain('Äpfel');
    expect(cause).not.toContain(API_KEY);
  });

  it('reports a missed deadline as timeout and a broken connection by its name only', async () => {
    const { fetch } = scriptedFetch(
      new DOMException('The operation timed out.', 'TimeoutError'),
      new TypeError('Lisa hat 3 Äpfel'),
      Object.assign(new Error(), { name: '' }),
    );
    const gemini = provider(fetch);

    expect((await gemini.suggest(REQUEST))._unsafeUnwrapErr()).toEqual({ kind: 'timeout' });
    const broken = (await gemini.suggest(REQUEST))._unsafeUnwrapErr();
    expect(broken.kind === 'unavailable' && String(broken.cause)).toContain('TypeError');
    expect(broken.kind === 'unavailable' && String(broken.cause)).not.toContain('Äpfel');
    expect((await gemini.suggest(REQUEST))._unsafeUnwrapErr().kind).toBe('unavailable');
  });
});
