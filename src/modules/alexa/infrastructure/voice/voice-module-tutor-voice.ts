import { getHostedSpeech } from '@modules/voice';

import type { TutorVoice } from '../../domain/ports/tutor-voice.port';

/**
 * The tutor `speakerId` (a catalog id such as `max`) speaks through the voice module's hosted speech.
 * Only fixed channel sentences are voiced (the voice module refuses any other text); everything else
 * falls back to Alexa's standard voice.
 */
export function voiceModuleTutorVoice(speakerId: string): TutorVoice {
  return {
    audioUrl: (text) =>
      getHostedSpeech()
        .execute({ speakerId, source: { kind: 'channel-line', text } })
        .map((hosted) => hosted.url),
  };
}
