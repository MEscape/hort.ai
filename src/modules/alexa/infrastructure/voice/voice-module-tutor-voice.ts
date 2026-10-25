import type { HostedSpeechInput } from '@modules/voice';

import { infrastructureError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { TutorVoice } from '../../domain/ports/tutor-voice.port';

/**
 * The tutor `speakerId` (a catalog id such as `max`) speaks through the voice module's hosted speech.
 * Only fixed channel sentences and catalog greetings are voiced (the voice module refuses any other
 * text); everything else falls back to Alexa's standard voice. The voice module is loaded on the first
 * reply, not with the route: request verification stays cheap, and Alexa's answer deadline is not
 * spent on imports.
 */
export function voiceModuleTutorVoice(speakerId: string): TutorVoice {
  return {
    audioUrl: (text) => hostedUrl({ speakerId, source: { kind: 'channel-line', text } }),
    lineUrl: (tutorId, text) =>
      hostedUrl({ speakerId: tutorId, source: { kind: 'channel-line', text } }),
    greetingUrl: (tutorId) =>
      hostedUrl({ speakerId: tutorId, source: { kind: 'phrase', phrase: 'greeting' } }),
  };
}

function hostedUrl(input: HostedSpeechInput): AppResultAsync<string> {
  return fromThrowableAsync(
    () => import('@modules/voice'),
    (cause) =>
      infrastructureError('alexa.voice_unavailable', 'Voice module failed to load.', cause),
  )
    .andThen(({ getHostedSpeech }) => getHostedSpeech().execute(input))
    .map((hosted) => hosted.url);
}
