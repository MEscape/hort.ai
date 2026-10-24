import { deAuth as auth } from '@modules/auth';
import { deClassroom as classroom } from '@modules/classroom';
import { deLearner as learner } from '@modules/learner';

import deApp from '../messages/de.json';

import type { MessageCatalog, TranslationSchema } from '../config';

/**
 * The German catalog:
 * Statically verified against the English `MessageCatalog` schema via `satisfies`.
 * Any missing, extra, or structurally mismatched key in `de.json` or any module's
 * German bundle will fail TypeScript compilation immediately.
 */
const messages = {
  app: deApp,
  auth: auth.auth,
  classroom: classroom.classroom,
  learner: learner.learner,
} as const satisfies TranslationSchema<MessageCatalog>;

export default messages;
