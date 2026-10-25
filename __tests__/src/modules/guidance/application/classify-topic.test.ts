import { describe, expect, it } from 'vitest';

import { classifyTopic } from '@modules/guidance/application/services/classify-topic';
import type { HintProviderFailure } from '@modules/guidance/domain/ports/hint-provider.port';
import type {
  TopicClassificationRequest,
  TopicClassifier,
} from '@modules/guidance/domain/ports/topic-classifier.port';

import { errAsync, okAsync } from '@lib/result';

import { recordingAuditLog, task } from '../fakes';

const TASK = task('Tim verteilt 12 Äpfel gerecht an 3 Kinder. Wie viele bekommt jedes?');
const CODE = 'he-kc-mathematik-primarstufe@2011:s2-4';
const CANDIDATES = [{ code: CODE, description: 'gerecht verteilen (Division)' }];

/** A stand-in for the topic classifier: it answers as scripted and keeps every request. */
function fakeTopicClassifier(
  script:
    | { readonly answer: unknown }
    | { readonly failure: HintProviderFailure }
    | { readonly throws: true },
) {
  const requests: TopicClassificationRequest[] = [];
  const classifier: TopicClassifier = {
    name: 'jev',
    classify(request) {
      requests.push(request);
      if ('throws' in script) {
        throw new Error('classifier exploded');
      }
      return 'failure' in script ? errAsync(script.failure) : okAsync(script.answer);
    },
  };
  return { classifier, requests };
}

const homework = (topicConfidence: number, subject = 'math') => ({
  version: 1,
  intent: { value: 'homework', confidence: 0.94 },
  subject: { value: subject, confidence: 0.97 },
  topic: { kind: 'competency', competencyCode: CODE, confidence: topicConfidence },
});

function run(
  classifier: TopicClassifier | undefined,
  options: { readonly clarificationAlreadyAsked?: boolean } = {},
) {
  const { audit, events } = recordingAuditLog();
  const result = classifyTopic(
    { audit, ...(classifier === undefined ? {} : { classifier }) },
    {
      task: TASK,
      subject: 'math',
      candidates: CANDIDATES,
      clarificationAlreadyAsked: options.clarificationAlreadyAsked ?? false,
    },
  );
  return { result, events };
}

const TODAYS_FLOW = {
  decision: { action: 'help', competencyCode: null, openTopicLabel: null },
  intent: null,
  classifiedBy: 'fallback',
};

describe('classifyTopic', () => {
  it('records a sure competency and logs the decision without any text', async () => {
    const { classifier, requests } = fakeTopicClassifier({ answer: homework(0.81) });
    const { result, events } = run(classifier);

    expect(await result).toEqual({
      decision: { action: 'help', competencyCode: CODE, openTopicLabel: null },
      intent: 'homework',
      classifiedBy: 'jev',
    });
    expect(requests).toEqual([{ task: TASK, subject: 'math', candidates: CANDIDATES }]);
    expect(events).toEqual([
      {
        type: 'guidance.topic_classified',
        classifiedBy: 'jev',
        intent: 'homework',
        intentConfidence: 'high',
        topic: 'competency',
        topicConfidence: 'high',
        action: 'help',
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('Äpfel');
  });

  it('asks to clarify an unsure topic once, then helps without a competency', async () => {
    const { classifier } = fakeTopicClassifier({ answer: homework(0.5) });

    expect((await run(classifier).result).decision).toEqual({ action: 'clarify' });
    expect((await run(classifier, { clarificationAlreadyAsked: true }).result).decision).toEqual({
      action: 'help',
      competencyCode: null,
      openTopicLabel: null,
    });
  });

  it('only logs a confidently different subject, the picked one wins', async () => {
    const { classifier } = fakeTopicClassifier({ answer: homework(0.81, 'german') });
    const { result, events } = run(classifier);

    expect((await result).decision).toMatchObject({ competencyCode: CODE });
    expect(events[0]).toEqual({
      type: 'guidance.topic_subject_mismatch',
      picked: 'math',
      classified: 'german',
    });
  });

  it.each([
    ['no classifier configured', undefined, 'provider_unavailable', []],
    ['a timeout', fakeTopicClassifier({ failure: { kind: 'timeout' } }).classifier, 'timeout', []],
    [
      'an unavailable classifier',
      fakeTopicClassifier({ failure: { kind: 'unavailable' } }).classifier,
      'provider_unavailable',
      [],
    ],
    [
      'a throwing adapter',
      fakeTopicClassifier({ throws: true }).classifier,
      'provider_unavailable',
      [],
    ],
    [
      'a competency outside the candidates (prompt injection)',
      fakeTopicClassifier({
        answer: {
          ...homework(0.99),
          topic: { kind: 'competency', competencyCode: 'kompetenz-x', confidence: 0.99 },
        },
      }).classifier,
      'invalid_output',
      ['guidance.topic_classification.unknown_competency'],
    ],
  ])(
    'falls back to today’s flow on %s, logging one fallback',
    async (_, classifier, reason, codes) => {
      const { result, events } = run(classifier);

      expect(await result).toEqual(TODAYS_FLOW);
      expect(events).toEqual([
        { type: 'guidance.topic_classification_fallback_used', reason, codes },
      ]);
    },
  );
});
