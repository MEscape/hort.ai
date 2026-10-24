import { getVoiceQueries, getVoiceRouteHandlers } from '@modules/voice';

/**
 * A tutor or the narrator speaks a catalog line (`{ speakerId, phrase }`) or a validated hint
 * (`{ speakerId, ticket }`), `audio/mpeg` out; words from the client are refused. The browser's
 * audio player is the consumer, so this is a Route Handler, not a Server Action.
 *
 * @authorization protected `SynthesizeSpeech` requires the signed-in parent's `voice.use` permission.
 */
export function POST(request: Request): Promise<Response> {
  return getVoiceRouteHandlers().speech(request, (input) =>
    getVoiceQueries().synthesizeSpeech.execute(input),
  );
}
