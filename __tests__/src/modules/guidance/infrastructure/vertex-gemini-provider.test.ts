import { describe, expect, it } from 'vitest';

import { buildFeedbackPrompt } from '@modules/guidance/domain/prompt/feedback-prompt';
import { buildHintPrompt } from '@modules/guidance/domain/prompt/hint-prompt';
import type { AccessTokenSource } from '@modules/guidance/infrastructure/vertex/service-account-token';
import {
  VertexGeminiProvider,
  vertexOrigin,
} from '@modules/guidance/infrastructure/vertex/vertex-gemini-provider';

import { errAsync, okAsync } from '@lib/result';

import { REQUEST, task } from '../fakes';

import { json, scriptedFetch, timeoutError } from './vertex-fetch';

const ANSWER = { version: 1, kind: 'hint', hintLevel: 'next_step', text: 'Was weißt du schon?' };
const FEEDBACK = { ...REQUEST, kind: 'answer_assessment' as const, answer: task('7') };

const reply = (text: string) => json({ candidates: [{ content: { parts: [{ text }] } }] });

function provider(
  fetch: typeof globalThis.fetch,
  accessToken: AccessTokenSource = () => okAsync('ya29.t'),
) {
  return new VertexGeminiProvider({
    projectId: 'hortai-eu',
    location: 'eu',
    modelId: 'gemini-3.8-flash',
    timeoutMs: 1000,
    accessToken,
    fetch,
  });
}

describe('VertexGeminiProvider', () => {
  it('sends the instructions as the system instruction and the data as the only user message', async () => {
    const { fetch, calls } = scriptedFetch(reply(JSON.stringify(ANSWER)));

    const answer = await provider(fetch).suggest(REQUEST);

    expect(answer._unsafeUnwrap()).toEqual(ANSWER);
    const { instructions, data } = buildHintPrompt(REQUEST);
    expect(calls[0]?.url).toBe(
      'https://aiplatform.eu.rep.googleapis.com/v1/projects/hortai-eu/locations/eu/publishers/google/models/gemini-3.8-flash:generateContent',
    );
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer ya29.t' });
    const body = JSON.parse(calls[0]?.body ?? '') as Record<string, unknown>;
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: data }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });
    expect(body['safetySettings']).toHaveLength(4);
    expect(JSON.stringify(body['safetySettings'])).not.toContain('BLOCK_NONE');
  });

  it('words answer feedback with the feedback prompt', async () => {
    const { fetch, calls } = scriptedFetch(reply('{"version":1}'));

    await provider(fetch).word(FEEDBACK);

    const body = JSON.parse(calls[0]?.body ?? '') as { contents: unknown };
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: buildFeedbackPrompt(FEEDBACK).data }] },
    ]);
  });

  it('joins split parts, passes non-JSON text on for the contract to reject, and has nothing for a blocked answer', async () => {
    const { fetch } = scriptedFetch(
      json({ candidates: [{ content: { parts: [{ text: '{"version":' }, { text: '1}' }] } }] }),
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

  it('reports a refused call with its status only', async () => {
    const { fetch } = scriptedFetch(json({ error: { message: 'Lisa hat 3 Äpfel' } }, 503));

    const failure = (await provider(fetch).suggest(REQUEST))._unsafeUnwrapErr();

    expect(failure.kind).toBe('unavailable');
    const cause = String(failure.kind === 'unavailable' && failure.cause);
    expect(cause).toContain('503');
    expect(cause).not.toContain('Äpfel');
  });

  it('reports a missed deadline as timeout and a broken connection as unavailable by name only', async () => {
    const { fetch } = scriptedFetch(timeoutError(), new TypeError('Lisa hat 3 Äpfel'));
    const gemini = provider(fetch);

    expect((await gemini.suggest(REQUEST))._unsafeUnwrapErr()).toEqual({ kind: 'timeout' });
    const broken = (await gemini.suggest(REQUEST))._unsafeUnwrapErr();
    expect(broken.kind === 'unavailable' && String(broken.cause)).toContain('TypeError');
    expect(broken.kind === 'unavailable' && String(broken.cause)).not.toContain('Äpfel');
  });

  it('does not call the model when no access token can be had', async () => {
    const { fetch, calls } = scriptedFetch();

    const failure = await provider(fetch, () => errAsync({ kind: 'timeout' })).suggest(REQUEST);

    expect(failure._unsafeUnwrapErr()).toEqual({ kind: 'timeout' });
    expect(calls).toEqual([]);
  });
});

describe('vertexOrigin', () => {
  it.each([
    ['eu', 'https://aiplatform.eu.rep.googleapis.com'],
    ['us', 'https://aiplatform.us.rep.googleapis.com'],
    ['global', 'https://aiplatform.googleapis.com'],
    ['europe-west4', 'https://europe-west4-aiplatform.googleapis.com'],
  ])('maps %s to its API host', (location, origin) => {
    expect(vertexOrigin(location)).toBe(origin);
  });
});
