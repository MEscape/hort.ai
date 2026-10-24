import { describe, expect, it } from 'vitest';

import { AI_OUTPUT_KINDS, AI_TEXT_MAX_LENGTH } from '@modules/guidance/domain/ai-output/ai-output';
import type { AiOutputKind, AiOutputRequest } from '@modules/guidance/domain/ai-output/ai-output';
import { validateAiOutput } from '@modules/guidance/domain/ai-output/validate-ai-output';
import {
  AI_OUTPUT_ERROR_CODES,
  AI_OUTPUT_VALIDATION_CODES as CODES,
} from '@modules/guidance/domain/errors/ai-output-errors';

const HINT_REQUEST: AiOutputRequest = { kind: 'hint', hintLevel: 'activate_prior_knowledge' };

function hint(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    kind: 'hint',
    hintLevel: 'activate_prior_knowledge',
    text: 'Was weißt du schon über das Zählen in Zehnerschritten?',
    ...fields,
  };
}

/** The field errors of a rejection; fails the test when the output was accepted. */
function rejectionOf(raw: unknown, request: AiOutputRequest = HINT_REQUEST) {
  const result = validateAiOutput(raw, request);
  if (result.isOk()) {
    throw new Error(`expected a rejection, got ${JSON.stringify(result.value)}`);
  }
  expect(result.error.kind).toBe('validation');
  expect(result.error.code).toBe(AI_OUTPUT_ERROR_CODES.rejected);
  return result.error.fieldErrors;
}

const VALID: ReadonlyArray<[AiOutputKind, Record<string, unknown>]> = [
  ['thinking_prompt', { text: 'Was genau sollst du in der Aufgabe herausfinden?' }],
  ['hint', { text: 'Schau dir die Einerstellen zuerst an.' }],
  ['praise', { text: 'Du hast die Zehner sauber untereinander geschrieben. Stark!' }],
  ['comprehension_question', { text: 'Warum hast du hier addiert und nicht subtrahiert?' }],
  ['answer_assessment', { result: 'partly_correct', text: 'Der Anfang stimmt schon.' }],
];

describe('validateAiOutput accepts', () => {
  it.each(VALID)('a valid %s', (kind, fields) => {
    const raw = { version: 1, kind, hintLevel: 'understand_task', ...fields };
    const result = validateAiOutput(raw, { kind, hintLevel: 'understand_task' });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(raw);
  });

  it('a curriculum competency reference', () => {
    const output = validateAiOutput(
      hint({ competencyId: 'de-by.m.3.zahlen-bis-1000' }),
      HINT_REQUEST,
    );
    expect(output._unsafeUnwrap().competencyId).toBe('de-by.m.3.zahlen-bis-1000');
  });

  it('an output without a competency reference, which is optional until #28', () => {
    expect(validateAiOutput(hint(), HINT_REQUEST)._unsafeUnwrap()).not.toHaveProperty(
      'competencyId',
    );
  });

  it('a text at exactly the maximum length, and returns it trimmed', () => {
    const text = 'a'.repeat(AI_TEXT_MAX_LENGTH.hint);
    expect(validateAiOutput(hint({ text: `  ${text}\n` }), HINT_REQUEST)._unsafeUnwrap().text).toBe(
      text,
    );
  });

  it.each([
    'Welche Zahl gehört in die Lücke: 3 + __ = 7?',
    'Ist 5 < 7 oder 7 < 5?',
    'Rechne zuerst 30 + 40 und dann die Einer, z.B. mit den Fingern.',
    'Prima, das hast du gut überlegt! 🎉',
  ])('homework wording such as %j', (text) => {
    expect(validateAiOutput(hint({ text }), HINT_REQUEST).isOk()).toBe(true);
  });
});

describe('validateAiOutput rejects the envelope', () => {
  it.each([null, undefined, 'Tipp: zähle weiter', 42, [hint()], new Date()])(
    'a value that is not a plain object (%j)',
    (raw) => {
      expect(rejectionOf(raw)).toEqual({ $: [CODES.notAnObject] });
    },
  );

  it.each([undefined, 2, '1', 0])('version %j', (version) => {
    expect(rejectionOf(hint({ version }))).toEqual({ version: [CODES.unsupportedVersion] });
  });

  it('a missing kind', () => {
    expect(rejectionOf(hint({ kind: undefined }))).toEqual({ kind: [CODES.missingField] });
  });

  it.each(['solution', 'html', 'Hint', 'exercise', 42])('the unknown kind %j', (kind) => {
    expect(rejectionOf(hint({ kind }))).toEqual({ kind: [CODES.unknownKind] });
  });

  it('a known kind other than the requested one, since the AI never picks the kind', () => {
    expect(rejectionOf(hint({ kind: 'praise' }))).toEqual({ kind: [CODES.unexpectedKind] });
  });
});

describe('validateAiOutput rejects fields', () => {
  it.each(['solution', 'answer', 'html', 'url', 'nextHintLevel', 'score'])(
    'the unknown field %j',
    (field) => {
      expect(rejectionOf(hint({ [field]: 'x' }))).toEqual({ [field]: [CODES.unknownField] });
    },
  );

  it('a result on a kind that is not an assessment', () => {
    expect(rejectionOf(hint({ result: 'correct' }))).toEqual({ result: [CODES.unknownField] });
  });

  it('a __proto__ member smuggled in through JSON', () => {
    const raw: unknown = JSON.parse(JSON.stringify(hint()).replace('{', '{"__proto__":{"x":1},'));
    expect(Object.entries(rejectionOf(raw))).toEqual([['__proto__', [CODES.unknownField]]]);
  });

  it.each([2, 'solution', 'Next_Step', '', null])('the hint level %j', (hintLevel) => {
    expect(rejectionOf(hint({ hintLevel }))).toEqual({ hintLevel: [CODES.invalidHintLevel] });
  });

  it('a missing hint level', () => {
    expect(rejectionOf(hint({ hintLevel: undefined }))).toEqual({
      hintLevel: [CODES.missingField],
    });
  });

  it('a valid hint level other than the requested one, since the backend picks the level', () => {
    expect(rejectionOf(hint({ hintLevel: 'similar_example' }))).toEqual({
      hintLevel: [CODES.unexpectedHintLevel],
    });
  });

  it.each(['', 'Zahlen bis 1000', 'A1', 'x'.repeat(65), 7, null])(
    'the competency id %j',
    (competencyId) => {
      expect(rejectionOf(hint({ competencyId }))).toEqual({
        competencyId: [CODES.invalidCompetencyId],
      });
    },
  );

  it.each([['solved'], ['wrong'], [true], [undefined]])('the assessment result %j', (result) => {
    const request: AiOutputRequest = { kind: 'answer_assessment', hintLevel: 'understand_task' };
    const raw = {
      version: 1,
      kind: 'answer_assessment',
      hintLevel: 'understand_task',
      text: 'Fast!',
      result,
    };
    expect(rejectionOf(raw, request)).toEqual({
      result: [result === undefined ? CODES.missingField : CODES.invalidAssessmentResult],
    });
  });

  it('every violation at once, keyed by field', () => {
    expect(rejectionOf(hint({ hintLevel: 'give_answer', text: '', extra: 1 }))).toEqual({
      extra: [CODES.unknownField],
      hintLevel: [CODES.invalidHintLevel],
      text: [CODES.textEmpty],
    });
  });
});

describe('validateAiOutput rejects text', () => {
  it.each([
    [undefined, CODES.missingField],
    [42, CODES.invalidType],
    [['Tipp'], CODES.invalidType],
    ['', CODES.textEmpty],
    ['   \n ', CODES.textEmpty],
  ])('%j', (text, code) => {
    expect(rejectionOf(hint({ text }))).toEqual({ text: [code] });
  });

  it.each(AI_OUTPUT_KINDS)('longer than %s allows', (kind) => {
    const raw = {
      version: 1,
      kind,
      hintLevel: 'understand_task',
      text: `${'a'.repeat(AI_TEXT_MAX_LENGTH[kind])}?`,
      ...(kind === 'answer_assessment' ? { result: 'not_yet' } : {}),
    };
    expect(rejectionOf(raw, { kind, hintLevel: 'understand_task' })).toEqual({
      text: [CODES.textTooLong],
    });
  });

  it('counts characters, not UTF-16 units, so emoji do not shorten the budget twice', () => {
    const text = '🎉'.repeat(AI_TEXT_MAX_LENGTH.hint);
    expect(validateAiOutput(hint({ text }), HINT_REQUEST).isOk()).toBe(true);
  });

  it.each([
    'Schau auf https://example.org nach.',
    'Hier: HTTP://x.y',
    'Klick javascript:alert(1)',
    'Gehe auf www.loesungen.de',
    'Die Lösung steht auf mathe-hilfe.com',
    'Schreib an mailto:lehrer@schule.de',
    'Ruf an: tel:0123',
  ])('a link: %j', (text) => {
    expect(rejectionOf(hint({ text }))).toEqual({ text: [CODES.containsUrl] });
  });

  it.each([
    '<b>Denk nach</b>',
    '<img src=x onerror=alert(1)>',
    '<!-- versteckt -->',
    'Tom &amp; Jerry',
    'Siehe [hier](wo)',
    '**Wichtig:** zähle',
    '~~falsch~~',
    '# Überschrift',
    '> Zitat',
  ])('markup: %j', (text) => {
    expect(rejectionOf(hint({ text }))['text']).toContain(CODES.containsMarkup);
  });

  it.each([
    'Tipp: `x + 1`',
    'const a = { b: 1 }',
    'x => x + 1',
    'Rufe eval("2+2") auf',
    'document.cookie lesen',
  ])('code: %j', (text) => {
    expect(rejectionOf(hint({ text }))['text']).toContain(CODES.containsCode);
  });

  it.each(['Zähle\u0000weiter', 'Zähle​weiter', 'Zähle‮weiter', 'Zähle\tweiter'])(
    'an invisible or control character in %j',
    (text) => {
      expect(rejectionOf(hint({ text }))).toEqual({ text: [CODES.containsControlCharacter] });
    },
  );

  it('a comprehension question that does not ask anything', () => {
    const request: AiOutputRequest = {
      kind: 'comprehension_question',
      hintLevel: 'understand_task',
    };
    const raw = {
      version: 1,
      kind: 'comprehension_question',
      hintLevel: 'understand_task',
      text: 'Erkläre, warum du addiert hast.',
    };
    expect(rejectionOf(raw, request)).toEqual({ text: [CODES.notAQuestion] });
  });
});

describe('validateAiOutput and the solution-leak guard (#31)', () => {
  it('leaves a shape-valid text that states the result to the leak guard, which needs the task', () => {
    // The contract cannot know that 47 is the answer to "23 + 24"; #31 checks the output against the task.
    expect(validateAiOutput(hint({ text: 'Das Ergebnis ist 47.' }), HINT_REQUEST).isOk()).toBe(
      true,
    );
  });
});

describe('AI output codes', () => {
  it('are stable dotted identifiers in the guidance namespace', () => {
    for (const code of [AI_OUTPUT_ERROR_CODES.rejected, ...Object.values(CODES)]) {
      expect(code).toMatch(/^guidance\.[a-z_]+(?:\.[a-z_]+)?$/);
    }
  });
});
