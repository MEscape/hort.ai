import 'server-only';

import { after } from 'next/server';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';

import { toTutorId } from './domain/models/ids';
import { verifyAlexaRequest } from './infrastructure/ask-sdk/ask-request-verifier';
import { demoChildCompanion } from './infrastructure/child/demo-child-companion';
import { connectionTestTutor } from './infrastructure/connection-test/connection-test-tutor';
import { catalogTutorIntroductions } from './infrastructure/tutors/catalog-tutor-introductions';
import { voiceModuleTutorVoice } from './infrastructure/voice/voice-module-tutor-voice';
import { createAlexaEndpoint } from './presentation/routes';

import type { TurnTiming } from './presentation/speech/child-channel';

const log = logger.withContext({ module: 'alexa' });

const introductions = catalogTutorIntroductions();

/**
 * Demo coupling (ALEXA_DEMO_GUARDIAN_ID + ALEXA_DEMO_CHILD_PROFILE_ID): the skill speaks for that one
 * child of that guardian, through the same use cases as the web, as auth's child channel (child-side
 * permissions only). Unset: the anonymous channel stays exactly as before.
 */
function demoChild() {
  const guardianId = serverEnv.ALEXA_DEMO_GUARDIAN_ID;
  const childProfileId = serverEnv.ALEXA_DEMO_CHILD_PROFILE_ID;
  if (guardianId === undefined || childProfileId === undefined) {
    return null;
  }
  return {
    companion: demoChildCompanion({
      guardianId,
      childProfileId,
      readyTutors: introductions.map((intro) => intro.tutorId),
      now: () => systemClock.now(),
    }),
    defaultTutorId: toTutorId(serverEnv.ALEXA_TUTOR_ID),
    // A help-session step that outlasts its turn finishes after the answer, so "weiter" finds it.
    keepAlive: (work: Promise<unknown>) => {
      after(work);
    },
    onTiming: (timing: TurnTiming) => {
      log.info('Alexa help-session turn', { ...timing });
    },
  };
}

/**
 * Alexa is a voice channel onto hort.ai. Verification stays as it is in every mode.
 * `tutor` answers free input of the anonymous channel (connection-test stub); `introductions`: on an
 * anonymous launch every ready tutor greets in catalog order, each in its own voice.
 * `voice` speaks fixed lines in a tutor's ElevenLabs voice (voice module); any failure keeps Alexa's.
 * ALEXA_TUTOR_ID picks the voice of anonymous replies; a coupled child hears its own companion.
 */
export const handleAlexaRequest = createAlexaEndpoint({
  skillId: serverEnv.ALEXA_SKILL_ID,
  verify: verifyAlexaRequest,
  tutor: connectionTestTutor,
  introductions,
  voice: serverEnv.ALEXA_TUTOR_VOICE ? voiceModuleTutorVoice(serverEnv.ALEXA_TUTOR_ID) : null,
  child: demoChild(),
  onVoiceFallback: (reason) => {
    log.warn('Alexa tutor voice unavailable; standard voice used', { reason });
  },
});
