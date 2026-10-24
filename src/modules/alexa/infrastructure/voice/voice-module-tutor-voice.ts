import { getHostedSpeech } from '@modules/voice';

import type { TutorVoice } from '../../domain/ports/tutor-voice.port';

/** The tutor `speakerId` (a catalog id such as `max`) speaks through the voice module's hosted speech. */
export function voiceModuleTutorVoice(speakerId: string): TutorVoice {
  return {
    audioUrl: (text) =>
      getHostedSpeech()
        .execute({ speakerId, text })
        .map((hosted) => hosted.url),
  };
}
