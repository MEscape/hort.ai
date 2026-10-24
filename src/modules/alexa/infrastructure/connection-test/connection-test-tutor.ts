import { okAsync } from '@lib/result';

import type { TutorConversation } from '../../domain/ports/tutor-conversation.port';

/** Exact operator-requested test sentence; not a learning response. */
export const CONNECTION_TEST_SENTENCE = 'Lennart wann holen wir uns draußen Suppe';

/**
 * Stub adapter until the tutor use case exists: every turn gets the test sentence and the conversation ends.
 * Replace it in composition.ts with an adapter onto the tutor module; nothing else changes.
 */
export const connectionTestTutor: TutorConversation = {
  respond: () => okAsync({ speech: CONNECTION_TEST_SENTENCE, conversation: 'closed' }),
};
