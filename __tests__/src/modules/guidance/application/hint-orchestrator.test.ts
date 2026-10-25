import { describe, expect, it } from 'vitest';

import { createHintOrchestrator } from '@modules/guidance';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import { HINT_LEVELS } from '@modules/guidance/domain/models/hint-level';

import { REQUEST, fakeHintProvider, fakeSafetyClassifier, recordingAuditLog, task } from '../fakes';

import type { ProviderScript } from '../fakes';

const VALID_TEXT = 'Was passiert mit der Zahl der Äpfel, wenn Lisa welche dazubekommt?';

/** A contract-conforming hint (#6) for the level the test requests. */
function hint(overrides: Record<string, unknown> = {}) {
  return { version: 1, kind: 'hint', hintLevel: 'next_step', text: VALID_TEXT, ...overrides };
}

function build(script: ProviderScript) {
  const { provider, requests } = fakeHintProvider(script);
  const { audit, events } = recordingAuditLog();
  return { orchestrator: new HintOrchestrator({ provider, audit }), requests, events };
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

describe('HintOrchestrator child safety (#11)', () => {
  it.each([
    ['asks for the address', 'Super! Wo wohnst du eigentlich?'],
    ['asks for a photo', 'Schick mir ein Foto von deinem Heft.'],
    ['asks for secrecy', 'Das bleibt unser Geheimnis, okay?'],
    ['insults the child', 'Du Versager, denk doch mal nach.'],
  ])('falls back when a contract-conforming hint %s', async (_case, text) => {
    const { orchestrator } = build({ answer: hint({ text }) });

    expect(await orchestrator.suggest(REQUEST)).toEqual({
      kind: 'fallback',
      level: 'next_step',
      reason: 'unsafe_output',
    });
  });

  it('logs a fallback with its level, reason and codes, never with the AI text or the task', async () => {
    const text = 'Wo wohnst du? Dann helfe ich dir.';
    const { orchestrator, events } = build({ answer: hint({ text }) });

    await orchestrator.suggest(REQUEST);

    expect(events).toEqual([
      {
        type: 'guidance.hint_fallback_used',
        level: 'next_step',
        reason: 'unsafe_output',
        codes: ['guidance.child_safety.asks_for_personal_data'],
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('wohnst');
    expect(JSON.stringify(events)).not.toContain('Äpfel');
  });

  it('logs the contract codes of a rejected answer', async () => {
    const { orchestrator, events } = build({ answer: hint({ kind: 'solution' }) });

    await orchestrator.suggest(REQUEST);

    expect(events).toMatchObject([
      { reason: 'invalid_output', codes: ['guidance.ai_output.unknown_kind'] },
    ]);
  });

  it('logs a provider failure without codes', async () => {
    const { orchestrator, events } = build({ failure: { kind: 'timeout' } });

    await orchestrator.suggest(REQUEST);

    expect(events).toMatchObject([{ reason: 'timeout', codes: [] }]);
  });

  it('logs nothing when the hint is shown', async () => {
    const { orchestrator, events } = build({ answer: hint() });

    await orchestrator.suggest(REQUEST);

    expect(events).toEqual([]);
  });
});

describe('HintOrchestrator solution-leak guard (#31)', () => {
  const SOLUTION_LEAKED = { kind: 'fallback', level: 'next_step', reason: 'solution_leaked' };

  it.each([
    ['the result', 'Das Ergebnis ist 7.'],
    ['the result spelled out', 'Dann hat Lisa sieben Äpfel.'],
    ['a dictated answer', 'Schreib: Lisa hat jetzt viele Äpfel.'],
  ])('falls back instead of showing a hint that states %s', async (_case, text) => {
    const { orchestrator } = build({ answer: hint({ text }) });

    expect(await orchestrator.suggest(REQUEST)).toEqual(SOLUTION_LEAKED);
  });

  it('checks the hint against the teacher’s solution key', async () => {
    const request = { ...REQUEST, task: task('Aufgabe 4 auf dem Arbeitsblatt') };
    const { orchestrator } = build({ answer: hint({ text: 'Kommt vielleicht 42 heraus?' }) });

    expect(await orchestrator.suggest(request, '42')).toEqual(SOLUTION_LEAKED);
    expect(await orchestrator.suggest(request)).toMatchObject({ kind: 'generated' });
  });

  it('logs the leak codes, never the text, the task or the solution', async () => {
    const { orchestrator, events } = build({ answer: hint({ text: 'Das Ergebnis ist 7.' }) });

    await orchestrator.suggest(REQUEST);

    expect(events).toEqual([
      {
        type: 'guidance.hint_fallback_used',
        level: 'next_step',
        reason: 'solution_leaked',
        codes: [
          'guidance.ai_output.solution_leaked',
          'guidance.solution_leak.states_result',
          'guidance.solution_leak.announces_result',
        ],
      },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/Ergebnis|Äpfel|7/);
  });

  it('never hands a leaking hint to the safety classifier', async () => {
    const { provider } = fakeHintProvider({ answer: hint({ text: 'Das Ergebnis ist 7.' }) });
    const { safety, texts } = fakeSafetyClassifier({ scores: {} });
    const orchestrator = new HintOrchestrator({
      provider,
      audit: recordingAuditLog().audit,
      safety,
    });

    expect(await orchestrator.suggest(REQUEST)).toEqual(SOLUTION_LEAKED);
    expect(texts).toEqual([]);
  });
});

describe('createHintOrchestrator', () => {
  it('always validates, whatever provider it is handed', async () => {
    const { provider } = fakeHintProvider({ answer: hint({ kind: 'solution' }) });

    expect(await createHintOrchestrator(provider).suggest(REQUEST)).toEqual(INVALID_OUTPUT);
  });
});

describe('HintOrchestrator with the safety classifier (#11)', () => {
  const ANSWER = hint();

  function withSafety(classifier: Parameters<typeof fakeSafetyClassifier>[0]) {
    const { provider } = fakeHintProvider({ answer: ANSWER });
    const { audit, events } = recordingAuditLog();
    const { safety, texts } = fakeSafetyClassifier(classifier);
    return { orchestrator: new HintOrchestrator({ provider, audit, safety }), events, texts };
  }

  it('lets a hint through that the classifier rates safe, and rates exactly the text shown', async () => {
    const { orchestrator, texts } = withSafety({
      scores: { 'guidance.child_safety.asks_for_secrecy': 0.02 },
    });

    expect(await orchestrator.suggest(REQUEST)).toMatchObject({ kind: 'generated' });
    expect(texts).toEqual([VALID_TEXT]);
  });

  it('falls back on a flagged rule and logs its code, never the text', async () => {
    const { orchestrator, events } = withSafety({
      scores: { 'guidance.child_safety.discouraging': 0.8 },
    });

    expect(await orchestrator.suggest(REQUEST)).toEqual({
      kind: 'fallback',
      level: 'next_step',
      reason: 'unsafe_output',
    });
    expect(events[0]).toMatchObject({ codes: ['guidance.child_safety.discouraging'] });
    expect(JSON.stringify(events)).not.toContain('Äpfel');
  });

  it('keeps the text from the child when the classifier cannot answer', async () => {
    const { orchestrator, events } = withSafety({ fails: true });

    expect(await orchestrator.suggest(REQUEST)).toMatchObject({
      kind: 'fallback',
      reason: 'provider_unavailable',
    });
    expect(events[0]).toMatchObject({ codes: ['guidance.child_safety.classifier_unavailable'] });
  });

  it('does not ask the classifier about an answer the word lists already rejected', async () => {
    const { provider } = fakeHintProvider({ answer: hint({ text: 'Wo wohnst du?' }) });
    const { audit } = recordingAuditLog();
    const { safety, texts } = fakeSafetyClassifier({ scores: {} });

    await new HintOrchestrator({ provider, audit, safety }).suggest(REQUEST);

    expect(texts).toEqual([]);
  });
});
