import { describe, expect, it } from 'vitest';

import { createHintOrchestrator } from '@modules/guidance';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import { HINT_LEVELS } from '@modules/guidance/domain/models/hint-level';
import type { HintOutputValidator } from '@modules/guidance/domain/ports/hint-output-validator.port';
import { interimHintOutputValidator } from '@modules/guidance/infrastructure/interim/interim-hint-output-validator';

import { ok } from '@lib/result';

import { REQUEST, fakeHintProvider, rejectingValidator } from '../fakes';

import type { ProviderScript } from '../fakes';

const VALID_HINT = 'Was passiert mit der Zahl der Äpfel, wenn Lisa welche dazubekommt?';

function build(
  script: ProviderScript,
  validator: HintOutputValidator = interimHintOutputValidator,
) {
  const { provider, requests } = fakeHintProvider(script);
  return { orchestrator: new HintOrchestrator({ provider, validator }), requests };
}

describe('HintOrchestrator', () => {
  it('passes a valid answer through for the requested level', async () => {
    const { orchestrator } = build({ answer: `  ${VALID_HINT}  ` });

    expect(await orchestrator.suggest(REQUEST)).toEqual({
      kind: 'generated',
      level: 'next_step',
      text: VALID_HINT,
    });
  });

  it('hands the provider the task, level and competencies as one data request', async () => {
    const { orchestrator, requests } = build({ answer: VALID_HINT });

    await orchestrator.suggest(REQUEST);

    expect(requests).toEqual([REQUEST]);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['blank', '   '],
    ['not text', { kind: 'hint', text: 42 }],
    ['too long', 'a'.repeat(501)],
  ])('falls back when the answer is %s', async (_case, answer) => {
    const { orchestrator } = build({ answer });

    expect(await orchestrator.suggest(REQUEST)).toEqual({
      kind: 'fallback',
      level: 'next_step',
      reason: 'invalid_output',
    });
  });

  it('falls back on any answer the validator rejects, such as an unknown kind', async () => {
    const unknownKind = { kind: 'solution', text: 'Lisa hat 7 Äpfel.' };
    const validator = rejectingValidator((raw) => raw === unknownKind);
    const { orchestrator } = build({ answer: unknownKind }, validator);

    expect(await orchestrator.suggest(REQUEST)).toMatchObject({
      kind: 'fallback',
      reason: 'invalid_output',
    });
  });

  it('never shows an answer the leak guard rejects', async () => {
    const leak = 'Rechne 3 + 4, das Ergebnis ist 7.';
    const validator = rejectingValidator((raw) => typeof raw === 'string' && raw.includes('7'));
    const { orchestrator } = build({ answer: leak }, validator);

    const outcome = await orchestrator.suggest(REQUEST);

    expect(outcome).toEqual({ kind: 'fallback', level: 'next_step', reason: 'invalid_output' });
    expect(JSON.stringify(outcome)).not.toContain('7');
  });

  it('rejects an answer for another level, because only the backend picks the level', async () => {
    const otherLevel: HintOutputValidator = {
      validate: (raw) => ok({ level: 'similar_example', text: String(raw) }),
    };
    const { orchestrator } = build({ answer: VALID_HINT }, otherLevel);

    expect(await orchestrator.suggest(REQUEST)).toEqual({
      kind: 'fallback',
      level: 'next_step',
      reason: 'invalid_output',
    });
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
    const { provider } = fakeHintProvider({ answer: 'a'.repeat(501) });

    expect(await createHintOrchestrator(provider).suggest(REQUEST)).toMatchObject({
      kind: 'fallback',
      reason: 'invalid_output',
    });
  });
});
