import { handleAlexaRequest } from '@modules/alexa';

/**
 * HTTPS delivery boundary for Amazon-signed Alexa requests; no learning logic.
 *
 * @authorization public Alexa calls this anonymously; authenticity is proven per request by the
 * official ASK signature/timestamp verifiers plus the configured skill id, and no user data is read.
 */
export async function POST(request: Request): Promise<Response> {
  return handleAlexaRequest(request);
}
