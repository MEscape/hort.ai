import { infrastructureError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';

import type { TutorVoice } from '../../domain/ports/tutor-voice.port';

/**
 * The tutor `speakerId` (a catalog id such as `max`) speaks through the voice module's hosted speech.
 * Only fixed channel sentences are voiced (the voice module refuses any other text); everything else
 * falls back to Alexa's standard voice. The voice module is loaded on the first reply, not with the
 * route: request verification stays cheap, and Alexa's answer deadline is not spent on imports.
 */
export function voiceModuleTutorVoice(speakerId: string): TutorVoice {
  return {
    audioUrl: (text) =>
      fromThrowableAsync(
        () => import('@modules/voice'),
        (cause) =>
          infrastructureError('alexa.voice_unavailable', 'Voice module failed to load.', cause),
      )
        .andThen(({ getHostedSpeech }) =>
          getHostedSpeech().execute({ speakerId, source: { kind: 'channel-line', text } }),
        )
        .map((hosted) => hosted.url),
  };
}
