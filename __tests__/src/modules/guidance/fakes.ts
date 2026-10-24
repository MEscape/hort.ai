import type { HintRequest } from '@modules/guidance/domain/models/hint-request';
import type {
  HintProvider,
  HintProviderFailure,
} from '@modules/guidance/domain/ports/hint-provider.port';

import { errAsync, okAsync } from '@lib/result';

export const REQUEST: HintRequest = {
  task: 'Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?',
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
