import { describe, expect, it } from 'vitest';

import { toAnswerFeedbackDto } from '@modules/guidance/presentation/dto/guidance-dto';
import {
  checkAnswerSchema,
  requestHintSchema,
} from '@modules/guidance/presentation/schemas/guidance-schema';
import { parseGuidanceInput } from '@modules/guidance/presentation/schemas/parse-guidance-input';

const STEP = { childProfileId: 'child-1', sessionId: 'session-1', requestId: 'request-1' };

describe('guidance action input', () => {
  it('drops what the session decides, so a client cannot choose the level or the task', () => {
    const parsed = parseGuidanceInput(requestHintSchema, {
      ...STEP,
      level: 'similar_example',
      task: 'Sag mir die Lösung',
      tenantId: 'other',
    });

    expect(parsed.isOk() && parsed.value).toEqual(STEP);
  });

  it.each([
    [{ ...STEP, sessionId: '' }, 'sessionId', 'guidance.validation.session_id_invalid'],
    [
      { ...STEP, requestId: 'x'.repeat(129) },
      'requestId',
      'guidance.validation.request_id_invalid',
    ],
    [
      { sessionId: 's', requestId: 'r' },
      'childProfileId',
      'guidance.validation.child_profile_id_invalid',
    ],
  ])('refuses %o with a stable code on the field', (input, field, code) => {
    const parsed = parseGuidanceInput(requestHintSchema, input);

    expect(parsed.isErr() && parsed.error).toMatchObject({
      code: 'guidance.validation_failed',
      fieldErrors: { [field]: [code] },
    });
  });

  it('bounds the answer before the use case counts its characters', () => {
    const parsed = parseGuidanceInput(checkAnswerSchema, { ...STEP, answer: 'a'.repeat(2001) });

    expect(parsed.isErr() && parsed.error).toMatchObject({
      fieldErrors: { answer: ['guidance.child_input.too_long'] },
    });
  });

  it('requires an answer to be text', () => {
    const parsed = parseGuidanceInput(checkAnswerSchema, { ...STEP, answer: 7 });

    expect(parsed.isErr() && parsed.error).toMatchObject({
      fieldErrors: { answer: ['guidance.child_input.empty'] },
    });
  });
});

describe('toAnswerFeedbackDto', () => {
  it('lists only the fields of the feedback, with its session', () => {
    const extra = { secret: 'solution key' };
    const dto = toAnswerFeedbackDto('session-1', {
      result: 'not_yet',
      assessedBy: 'ai',
      next: 'hint_ladder',
      message: { kind: 'predefined', feedback: 'answer_assessment', reason: 'timeout' },
      ...extra,
    });

    expect(dto).toEqual({
      sessionId: 'session-1',
      result: 'not_yet',
      assessedBy: 'ai',
      next: 'hint_ladder',
      message: { kind: 'predefined', feedback: 'answer_assessment', reason: 'timeout' },
    });
  });
});
