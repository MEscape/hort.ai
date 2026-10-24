import { describe, expect, it } from 'vitest';

import { createHintOrchestrator } from '@modules/guidance';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import { HINT_LEVELS } from '@modules/guidance/domain/models/hint-level';

import { REQUEST, fakeHintProvider } from '../fakes';

import type { ProviderScript } from '../fakes';

const VALID_TEXT = 'Was passiert mit der Zahl der Äpfel, wenn Lisa welche dazubekommt?';

/** A contract-conforming hint (#6) for the level the test requests. */
function hint(overrides: Record<string, unknown> = {}) {
  return { version: 1, kind: 'hint', hintLevel: 'next_step', text: VALID_TEXT, ...overrides };
}

function build(script: ProviderScript) {
  const { provider, requests } = fakeHintProvider(script);
  return { orchestrator: new HintOrchestrator({ provider }), requests };
}

const INVALID_OUTPUT = { kind: 'fallback', level: 'next_step', reason: 'invalid_output' };

describe('HintOrchestrator', () => {
  it('passes a valid hint through for the requested level', async () => {
    const { orchestrator } = build({ answer: hint({ text: `  ${VALID_TEXT}  ` }) });

    expect(await orchestrator.suggest(REQUEST)).toEqual({
      kind: 'generated',
      level: 'next_step',
      text: VALID_TEXT,
    });
  });

  it('hands the provider the task, level and competencies as one data request', async () => {
    const { orchestrator, requests } = build({ answer: hint() });

    await orchestrator.suggest(REQUEST);

    expect(requests).toEqual([REQUEST]);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['plain text instead of the contract', VALID_TEXT],
    ['without text', hint({ text: undefined })],
    ['blank', hint({ text: '   ' })],
    ['too long', hint({ text: 'a'.repeat(281) })],
    ['of an unknown kind', hint({ kind: 'solution' })],
    ['of another allowed kind', hint({ kind: 'praise' })],
    ['with an unknown field', hint({ answer: 7 })],
    ['of another contract version', hint({ version: 2 })],
    ['markup', hint({ text: '<b>Denk nach</b>' })],
    ['a link', hint({ text: 'Schau auf https://example.com nach.' })],
  ])('falls back when the answer is %s', async (_case, answer) => {
    const { orchestrator } = build({ answer });

    expect(await orchestrator.suggest(REQUEST)).toEqual(INVALID_OUTPUT);
  });

  it('rejects a hint for another level, because only the backend picks the level', async () => {
    const { orchestrator } = build({ answer: hint({ hintLevel: 'similar_example' }) });

    expect(await orchestrator.suggest(REQUEST)).toEqual(INVALID_OUTPUT);
  });

  it('falls back on a timeout', async () => {
    const { orchestrator } = build({ failure: { kind: 'timeout' } });

    expect(await orchestrator.suggest(REQUEST)).toEqual({
      kind: 'fallback',
      level: 'next_step',
      reason: 'timeout',
    });
  });

  it('falls back when the provider is unavailable', async () => {
    const { orchestrator } = build({ failure: { kind: 'unavailable', cause: new Error('503') } });

    expect(await orchestrator.suggest(REQUEST)).toMatchObject({ reason: 'provider_unavailable' });
  });

  it('falls back when the provider throws instead of returning its failure', async () => {
    const { orchestrator } = build({ throws: true });

    expect(await orchestrator.suggest(REQUEST)).toMatchObject({ reason: 'provider_unavailable' });
  });

  it.each(HINT_LEVELS)('keeps the requested level %s in its fallback', async (level) => {
    const { orchestrator } = build({ failure: { kind: 'timeout' } });

    expect(await orchestrator.suggest({ ...REQUEST, level })).toMatchObject({
      kind: 'fallback',
      level,
    });
  });
});

describe('createHintOrchestrator', () => {
  it('always validates, whatever provider it is handed', async () => {
    const { provider } = fakeHintProvider({ answer: hint({ kind: 'solution' }) });

    expect(await createHintOrchestrator(provider).suggest(REQUEST)).toEqual(INVALID_OUTPUT);
  });
});
