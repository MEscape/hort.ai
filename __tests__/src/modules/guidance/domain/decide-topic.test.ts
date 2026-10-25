import { describe, expect, it } from 'vitest';

import {
  decideArea,
  decideTopic,
  isSubjectMismatch,
} from '@modules/guidance/domain/topic/decide-topic';
import type {
  ChildMessageIntent,
  TopicClassification,
  TopicGuess,
} from '@modules/guidance/domain/topic/topic-classification';

const CODE = 'he-kc-mathematik-primarstufe@2011:s2-4';
const FIRST_TIME = { clarificationAlreadyAsked: false };
const ASKED = { clarificationAlreadyAsked: true };
const HELP_WITHOUT_TOPIC = { action: 'help', competencyCode: null, openTopicLabel: null };

function classified(
  intent: ChildMessageIntent,
  intentConfidence: number,
  topic: TopicGuess = { kind: 'none' },
): TopicClassification {
  return {
    version: 1,
    intent: { value: intent, confidence: intentConfidence },
    subject: { value: 'math', confidence: 0.9 },
    topic,
    area: null,
  };
}

const competency = (confidence: number): TopicGuess => ({
  kind: 'competency',
  competencyCode: CODE,
  confidence,
});
const open = (confidence: number): TopicGuess => ({ kind: 'open', label: 'brüche', confidence });

describe('decideTopic', () => {
  it.each([
    [0.59, { action: 'clarify' }],
    [0.6, { action: 'help', competencyCode: CODE, openTopicLabel: null }],
  ])('asks to clarify only below an intent confidence of 0.6 (%d)', (confidence, decision) => {
    expect(decideTopic(classified('homework', confidence, competency(0.9)), FIRST_TIME)).toEqual(
      decision,
    );
  });

  it.each(['small_talk', 'curiosity'] as const)('redirects %s with a sure intent', (intent) => {
    expect(decideTopic(classified(intent, 0.6), FIRST_TIME)).toEqual({
      action: 'redirect',
      intent,
    });
  });

  it.each([
    [0.7, { action: 'help', competencyCode: CODE, openTopicLabel: null }],
    [0.69, { action: 'clarify' }],
    [0.4, { action: 'clarify' }],
    [0.39, HELP_WITHOUT_TOPIC],
  ])('decides a competency of confidence %d', (confidence, decision) => {
    expect(decideTopic(classified('homework', 0.9, competency(confidence)), FIRST_TIME)).toEqual(
      decision,
    );
  });

  it.each([
    [0.7, { action: 'help', competencyCode: null, openTopicLabel: 'brüche' }],
    [0.69, { action: 'clarify' }],
    [0.39, HELP_WITHOUT_TOPIC],
  ])(
    'keeps an open label of confidence %d only when sure, never as a competency',
    (confidence, decision) => {
      expect(decideTopic(classified('homework', 0.9, open(confidence)), FIRST_TIME)).toEqual(
        decision,
      );
    },
  );

  it('helps without a competency when no topic fits', () => {
    expect(decideTopic(classified('homework', 0.9), FIRST_TIME)).toEqual(HELP_WITHOUT_TOPIC);
  });

  it.each([
    ['an unsure intent', classified('homework', 0.3)],
    ['an unsure topic', classified('homework', 0.9, competency(0.5))],
  ])('never asks a second time, for %s', (_, classification) => {
    expect(decideTopic(classification, ASKED)).toEqual(HELP_WITHOUT_TOPIC);
  });
});

describe('isSubjectMismatch', () => {
  const withSubject = (confidence: number): TopicClassification => ({
    ...classified('homework', 0.9),
    subject: { value: 'german', confidence },
  });

  it.each([
    [0.8, true],
    [0.79, false],
  ])('reports another subject at confidence %d: %s', (confidence, expected) => {
    expect(isSubjectMismatch(withSubject(confidence), 'math')).toBe(expected);
  });

  it('does not report the picked subject or no subject', () => {
    expect(isSubjectMismatch(withSubject(0.99), 'german')).toBe(false);
    expect(isSubjectMismatch({ ...withSubject(0.99), subject: null }, 'math')).toBe(false);
  });
});

describe('decideArea', () => {
  const homework = (area: TopicClassification['area']): TopicClassification => ({
    ...classified('homework', 0.9, competency(0.9)),
    area,
  });
  const HELP = { action: 'help', competencyCode: CODE, openTopicLabel: null } as const;

  it('keeps a sure island of a homework task the backend helps with', () => {
    expect(decideArea(homework({ areaId: 'zahlenwald', confidence: 0.7 }), HELP)).toBe(
      'zahlenwald',
    );
  });

  it('keeps no island below 0.7 or without one, so an unsure answer clears nothing', () => {
    expect(decideArea(homework({ areaId: 'zahlenwald', confidence: 0.69 }), HELP)).toBeNull();
    expect(decideArea(homework(null), HELP)).toBeNull();
  });

  it('never keeps the fallback island, which only means the classifier was unsure', () => {
    expect(decideArea(homework({ areaId: 'ueberraschungsinsel', confidence: 1 }), HELP)).toBeNull();
  });

  it('keeps no island when the session opens with a clarifying question or a redirect', () => {
    const sure = homework({ areaId: 'zahlenwald', confidence: 0.95 });
    expect(decideArea(sure, { action: 'clarify' })).toBeNull();
    expect(decideArea(sure, { action: 'redirect', intent: 'curiosity' })).toBeNull();
  });
});
