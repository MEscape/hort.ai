import 'server-only';

import { serverEnv } from '@lib/config/server';

import { verifyAlexaRequest } from './infrastructure/ask-sdk/ask-request-verifier';
import { createConnectionTest } from './presentation/routes';

/** Connectivity-only stage; learning-core wiring follows the Echo transport proof. */
export const handleAlexaRequest = createConnectionTest({
  skillId: serverEnv.ALEXA_SKILL_ID,
  verify: verifyAlexaRequest,
});
