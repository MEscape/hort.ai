import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { CurrentActorProvider } from '@modules/auth/domain/ports/current-actor-provider.port';
import { ClassifyChildTask } from '@modules/guidance/application/commands/classify-child-task';
import type { TopicClassificationRequest } from '@modules/guidance/domain/ports/topic-classifier.port';

import { okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { parent, recordingAudit as recordingSecurityAudit, signedInAs } from '../../auth/fakes';
import {
  OTHER_CHILD,
  OWN_CHILD,
  REQUEST,
  fakeCompetencies,
  ownChildren,
  recordingAuditLog,
} from '../fakes';

const TASK = 'Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?';
const CODE = REQUEST.competencies[0]?.code ?? '';

function build(options: { readonly currentActor?: CurrentActorProvider } = {}) {
  const requests: TopicClassificationRequest[] = [];
  const { audit, events } = recordingAuditLog();
  const { retrieval } = fakeCompetencies();
  const classifyChildTask = new ClassifyChildTask({
    authorization: createAuthorizationService({
      currentActor: options.currentActor ?? signedInAs(parent()),
      audit: recordingSecurityAudit(),
    }),
    childProfiles: ownChildren(),
    competencies: retrieval,
    rateLimiter: createTestRateLimiter(),
    audit,
    classifier: {
      name: 'jev',
      classify(request) {
        requests.push(request);
        return okAsync({
          version: 1,
          intent: { value: 'homework', confidence: 0.9 },
          subject: { value: 'math', confidence: 0.9 },
          topic: { kind: 'competency', competencyCode: CODE, confidence: 0.8 },
        });
      },
    },
  });
  return { classifyChildTask, requests, events };
}

const input = (childProfileId: string = OWN_CHILD) => ({
  childProfileId,
  task: `  ${TASK}\r\n`,
  subject: 'math',
});

describe('ClassifyChildTask', () => {
  it('classifies the checked task of the parent’s own child against its curriculum', async () => {
    const { classifyChildTask, requests, events } = build();

    const result = await classifyChildTask.execute(input());

    expect(result._unsafeUnwrap()).toEqual({
      decision: { action: 'help', competencyCode: CODE, openTopicLabel: null },
      intent: 'homework',
      classifiedBy: 'jev',
    });
    expect(requests).toEqual([{ task: TASK, subject: 'math', candidates: REQUEST.competencies }]);
    expect(events.at(-1)).toMatchObject({
      type: 'guidance.child_task_classified',
      childProfileId: OWN_CHILD,
      action: 'help',
      classifiedBy: 'jev',
    });
    expect(JSON.stringify(events)).not.toContain('Äpfel');
  });

  it('treats another parent’s child as not found, before any classifier call', async () => {
    const { classifyChildTask, requests, events } = build();

    const result = await classifyChildTask.execute(input(OTHER_CHILD));

    expect(result.isErr() && result.error.kind).toBe('not_found');
    expect(requests).toEqual([]);
    expect(events).toEqual([]);
  });

  it('refuses empty text before anything is looked up', async () => {
    const { classifyChildTask, requests } = build();

    const result = await classifyChildTask.execute({ ...input(), task: '   ' });

    expect(result.isErr() && result.error.code).toBe('guidance.child_input_invalid');
    expect(requests).toEqual([]);
  });
});

describe('ClassifyChildTask distress check (#90)', () => {
  it('never hands a distress message to the classifier', async () => {
    const { classifyChildTask, requests, events } = build();

    const result = await classifyChildTask.execute({
      childProfileId: OWN_CHILD,
      task: 'Ich will nicht mehr leben',
      subject: 'math',
    });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: 'guidance.child_safety.distress_signal',
    });
    expect(requests).toEqual([]);
    expect(events).toEqual([
      { type: 'guidance.child_safety.distress_signal', category: 'self_harm', field: 'task' },
    ]);
  });
});
