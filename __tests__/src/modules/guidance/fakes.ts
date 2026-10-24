import { parseChildTaskText } from '@modules/guidance/domain/models/child-task-text';
import type { ChildTaskText } from '@modules/guidance/domain/models/child-task-text';
import type { HintRequest } from '@modules/guidance/domain/models/hint-request';
import type { GuidanceEvent } from '@modules/guidance/domain/ports/guidance-audit-log.port';
import type {
  HintProvider,
  HintProviderFailure,
} from '@modules/guidance/domain/ports/hint-provider.port';

import { errAsync, okAsync } from '@lib/result';

/** A task text as the input check produces it; a test that needs another text goes through the same check. */
export function task(text: string): ChildTaskText {
  return parseChildTaskText(text)._unsafeUnwrap();
}

export const REQUEST: HintRequest = {
  task: task('Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?'),
  level: 'next_step',
  competencies: [{ code: 'M2.1', description: 'Addieren im Zahlenraum bis 20' }],
};

/** What the scripted provider does on its next call. */
export type ProviderScript =
  | { readonly answer: unknown }
  | { readonly failure: HintProviderFailure }
  | { readonly throws: true };

/** A deterministic stand-in for the AI model: it answers exactly as scripted and keeps what it was asked. */
export function fakeHintProvider(script: ProviderScript) {
  const requests: HintRequest[] = [];
  const provider: HintProvider = {
    suggest(request) {
      requests.push(request);
      if ('throws' in script) {
        throw new Error('provider exploded');
      }
      return 'failure' in script ? errAsync(script.failure) : okAsync(script.answer);
    },
  };
  return { provider, requests };
}

/** Keeps every event the orchestration logs, so a test can check what operations would see. */
export function recordingAuditLog() {
  const events: GuidanceEvent[] = [];
  return { audit: { record: (event: GuidanceEvent) => events.push(event) }, events };
}
