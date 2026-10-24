import { getVoiceQueries, getVoiceRouteHandlers } from '@modules/voice';

/**
 * A child's recording becomes text: multipart fields `childProfileId` and `audio` in, JSON `{ text }`
 * out, only while the parent consented to voice input on that child's profile. The recording
 * is read into memory for this request only and never stored.
 *
 * @authorization protected `TranscribeSpeech` requires the signed-in parent's `voice.use` permission,
 * ownership of the named child profile and its `voiceConsent`.
 */
export function POST(request: Request): Promise<Response> {
  return getVoiceRouteHandlers().transcription(request, (input) =>
    getVoiceQueries().transcribeSpeech.execute(input),
  );
}
