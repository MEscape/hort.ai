import type { AppResultAsync } from '@lib/result';
import { TimeoutError, withTimeout } from '@lib/utils';

import type { TutorReply } from '../../application/contracts/tutor-conversation-model';

/**
 * Time the tutor's voice may take (synthesis and upload on a cache miss) before the answer falls back to
 * Alexa's voice. Alexa waits 8 s in total; verification (a cold certificate download) and a cold start need
 * the rest.
 */
export const VOICE_DEADLINE_MS = 4_000;
/**
 * APL for Audio plays on every Alexa device and needs no interface in the skill manifest, so requests do not
 * list it in `supportedInterfaces` (verified in the simulator); there is nothing to check per device.
 */
const APLA_INTERFACE = 'Alexa.Presentation.APLA';
/** APL for Audio specification version (Amazon: "Currently 0.91"). */
const APLA_VERSION = '0.91';

/** Alexa session attributes: surface state the channel gets back with the next request. */
export type SessionAttributes = Readonly<Record<string, unknown>>;

/** How a reply ends and what Alexa says when the child stays silent (defaults to the reply itself). */
export interface SpeechEnding {
  readonly reprompt?: string;
  readonly sessionAttributes?: SessionAttributes;
}

export interface VoiceTiming {
  readonly voiceDeadlineMs?: number;
  /** Told why a reply fell back to Alexa's voice (an error code or `timeout`); never the text or a URL. */
  readonly onVoiceFallback?: (reason: string) => void;
}

/** A clip URL within the deadline, or `null` for Alexa's own voice. Never fails. */
export async function voiced(
  load: () => AppResultAsync<string>,
  timing: VoiceTiming,
): Promise<string | null> {
  const { onVoiceFallback } = timing;
  try {
    const url = await withTimeout(
      Promise.resolve(load()),
      timing.voiceDeadlineMs ?? VOICE_DEADLINE_MS,
    );
    if (url.isOk()) {
      return url.value;
    }
    onVoiceFallback?.(url.error.code);
  } catch (thrown) {
    onVoiceFallback?.(thrown instanceof TimeoutError ? 'timeout' : 'unexpected');
  }
  return null;
}

/** PlainText keeps Alexa's standard voice; an open conversation re-prompts (by default with the same text). */
export function speak(reply: TutorReply, ending: SpeechEnding = {}): Response {
  const isOpen = reply.conversation === 'open';
  return Response.json({
    version: '1.0',
    ...sessionPart(isOpen, ending),
    response: {
      outputSpeech: { type: 'PlainText', text: reply.speech },
      ...repromptPart(isOpen, reply, ending),
      shouldEndSession: !isOpen,
    },
  });
}

/** What an APL for Audio reply plays: a clip or a sequence of parts, under a document token. */
export interface AudioDocument {
  readonly item: Record<string, unknown>;
  readonly token: string;
}

/** One APL for Audio document whose main template plays `audio.item`. */
export function renderAudio(
  reply: TutorReply,
  audio: AudioDocument,
  ending: SpeechEnding = {},
): Response {
  const { item, token } = audio;
  const isOpen = reply.conversation === 'open';
  return Response.json({
    version: '1.0',
    ...sessionPart(isOpen, ending),
    response: {
      directives: [
        {
          type: `${APLA_INTERFACE}.RenderDocument`,
          token,
          document: {
            type: 'APLA',
            version: APLA_VERSION,
            mainTemplate: { item },
          },
        },
      ],
      ...repromptPart(isOpen, reply, ending),
      shouldEndSession: !isOpen,
    },
  });
}

function sessionPart(isOpen: boolean, ending: SpeechEnding) {
  return isOpen && ending.sessionAttributes ? { sessionAttributes: ending.sessionAttributes } : {};
}

function repromptPart(isOpen: boolean, reply: TutorReply, ending: SpeechEnding) {
  const text = ending.reprompt ?? reply.speech;
  return isOpen ? { reprompt: { outputSpeech: { type: 'PlainText', text } } } : {};
}
