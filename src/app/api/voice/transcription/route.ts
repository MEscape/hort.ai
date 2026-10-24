import { getVoiceQueries, getVoiceRouteHandlers } from '@modules/voice';

/**
 * A child's recording becomes text: multipart field `audio` in, JSON `{ text }` out. The recording
 * is read into memory for this request only and never stored.
 *
 * @authorization protected `TranscribeSpeech` requires the signed-in parent's `voice.use` permission.
 */
export function POST(request: Request): Promise<Response> {
  return getVoiceRouteHandlers().transcription(request, (input) =>
    getVoiceQueries().transcribeSpeech.execute(input),
  );
}
