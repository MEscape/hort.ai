import { z } from 'zod';

import { TimeoutError, clamp, withTimeout } from '@lib/utils';

import { VOICE_DEADLINE_MS, renderAudio, speak, voiced } from './alexa-speech';
import { childDialog, needsBackend, timedOutReply } from './child-dialog';

import type { SessionAttributes, VoiceTiming } from './alexa-speech';
import type { ChildIntent, ChildReply, DialogSurface, SpokenPart } from './child-dialog';
import type { ChildCompanion } from '../../application/contracts/child-companion-model';
import type {
  TutorId,
  TutorIntroduction,
  TutorVoice,
} from '../../application/contracts/tutor-voice-model';

/** The demo coupling as the route sees it: the bound child's operations and who speaks by default. */
export interface ChildChannel {
  readonly companion: ChildCompanion;
  /** Speaks when the child has no ready companion (`ALEXA_TUTOR_ID`). */
  readonly defaultTutorId: TutorId;
  /** Time the child's use cases (database) may take in total for one turn; tests shorten it. */
  readonly backendDeadlineMs?: number;
}

export interface ChildRequest {
  readonly type: 'LaunchRequest' | 'IntentRequest';
  readonly intent?: string | undefined;
  readonly utterance?: string | undefined;
  readonly attributes?: SessionAttributes | undefined;
}

interface ChildChannelDeps extends VoiceTiming {
  readonly child: ChildChannel;
  /** When the whole request must be answered (`now()` milliseconds), verification already spent. */
  readonly deadlineAt: number;
  readonly now: () => number;
  readonly introductions: readonly TutorIntroduction[];
  readonly voice: TutorVoice | null;
}

const CHILD_VOICE_TOKEN = 'child-companion';
/**
 * Within the request's budget (`deadlineAt`, counted before verification), a turn spends at most this on
 * the child's use cases and at most `CHILD_VOICE_DEADLINE_MS` on the clips, each capped by what is left:
 * the use cases keep `VOICE_RESERVE_MS` free for the answer, clips stop `RENDER_RESERVE_MS` before the
 * deadline, and with no time left the answer is plain text. A turn that needs no use case (stop, help,
 * repeat) never waits for the database at all.
 */
const CHILD_BACKEND_DEADLINE_MS = 3_000;
const CHILD_VOICE_DEADLINE_MS = 3_000;
const VOICE_RESERVE_MS = 1_000;
const RENDER_RESERVE_MS = 200;
/** The only intent of the first interaction model; its free text is mapped by keywords. */
const FREE_INPUT_INTENT = 'FreieEingabeIntent';
const MAX_REMEMBERED_PARTS = 8;
const MAX_PART_LENGTH = 600;

/** Intent names of interaction model v2 (alexa/skill-package/interactionModels/custom/de-DE.json). */
const INTENTS: Readonly<Record<string, ChildIntent>> = {
  FuetternIntent: 'feed',
  LevelIntent: 'level',
  SchulaufgabenIntent: 'tasks',
  // Phase 2 (help session): honest placeholder until the session commands are wired.
  AufgabeIntent: 'soon',
  NeueAufgabeIntent: 'soon',
  TippIntent: 'soon',
  AntwortIntent: 'soon',
  AufgabeVorlesenIntent: 'soon',
  WeitermachenIntent: 'soon',
  AuswahlIntent: 'soon',
  PauseIntent: 'stop',
  'AMAZON.YesIntent': 'yes',
  'AMAZON.NoIntent': 'no',
  'AMAZON.HelpIntent': 'help',
  'AMAZON.RepeatIntent': 'repeat',
  'AMAZON.StopIntent': 'stop',
  'AMAZON.CancelIntent': 'stop',
  'AMAZON.NavigateHomeIntent': 'stop',
  'AMAZON.FallbackIntent': 'unknown',
};

/**
 * Free input (the catch-all `FreieEingabeIntent`, the only intent of the first interaction model) is
 * mapped by keywords, so the channel works before and after the console is rebuilt. First match wins;
 * stopping is checked first so "tschüss" always ends. The words are matched, never logged or stored.
 */
const FREE_INPUT_RULES: ReadonlyArray<readonly [RegExp, ChildIntent]> = [
  [/\b(tschüss|tschüs|stopp?|beenden|aufhören|ende)\b/, 'stop'],
  [/^(ja|jawohl|jo|gerne?|okay|ok|klar)\b/, 'yes'],
  [/^(nein|nee|nö|nicht jetzt)(?![\p{L}])/u, 'no'],
  [/fütter|futter|snack|hunger|\bessen\b/, 'feed'],
  [/level|sterne/, 'level'],
  [/was hab(e)? ich auf|welche (haus)?aufgaben|aufgaben von der schule|aufgegeben/, 'tasks'],
  [/hilfe|was kann ich/, 'help'],
  [/nochmal|noch einmal|wiederhol|wie bitte/, 'repeat'],
  [/aufgabe|antwort|tipp|ergebnis|weiter|pause|erste|zweite|dritte|nummer/, 'soon'],
];

const partSchema = z.object({
  kind: z.enum(['line', 'alexa']),
  text: z.string().max(MAX_PART_LENGTH),
});
/**
 * Surface state only (rule 10): the open yes/no question, the last reply for "Wiederholen", and whose
 * voice spoke it, so a turn without a use case keeps that voice without asking the database.
 */
const surfaceSchema = z.object({
  question: z.literal('feed').nullable().optional(),
  last: z.array(partSchema).max(MAX_REMEMBERED_PARTS).optional(),
  speaker: z.string().max(MAX_PART_LENGTH).optional(),
});

/** Maps a request onto the child dialog and its reply onto Alexa speech in the companion's voice. */
export async function respondToChild(
  request: ChildRequest,
  deps: ChildChannelDeps,
): Promise<Response> {
  const intent = request.type === 'LaunchRequest' ? 'launch' : intentOf(request);
  const { surface, speaker: lastSpeaker } = readSurface(request.attributes, deps);
  const { companion, defaultTutorId, backendDeadlineMs } = deps.child;
  const fallbackSpeaker = lastSpeaker ?? defaultTutorId;
  if (!needsBackend(intent, surface)) {
    return render(await childDialog(intent, surface, companion), fallbackSpeaker, deps);
  }
  try {
    // The companion's voice comes from the profile, in parallel with the operation, under one deadline.
    const [own, reply] = await withTimeout(
      Promise.all([
        Promise.resolve(companion.companion()),
        childDialog(intent, surface, companion),
      ]),
      clamp(timeLeft(deps) - VOICE_RESERVE_MS, 0, backendDeadlineMs ?? CHILD_BACKEND_DEADLINE_MS),
    );
    return await render(reply, (own.isOk() ? own.value : null) ?? fallbackSpeaker, deps);
  } catch (thrown) {
    if (!(thrown instanceof TimeoutError)) {
      throw thrown;
    }
    return render(timedOutReply(intent), fallbackSpeaker, deps);
  }
}

function timeLeft(deps: ChildChannelDeps): number {
  return deps.deadlineAt - deps.now();
}

function intentOf(request: ChildRequest): ChildIntent {
  const name = request.intent ?? '';
  const mapped = INTENTS[name];
  if (mapped !== undefined) {
    return mapped;
  }
  // Keywords map the free input only: an intent this channel does not know is not understood, whatever
  // its slot holds.
  const words = name === FREE_INPUT_INTENT ? (request.utterance?.toLowerCase().trim() ?? '') : '';
  if (words.length === 0) {
    return 'unknown';
  }
  return FREE_INPUT_RULES.find(([pattern]) => pattern.test(words))?.[1] ?? 'unknown';
}

function readSurface(
  attributes: SessionAttributes | undefined,
  deps: ChildChannelDeps,
): { surface: DialogSurface; speaker: TutorId | null } {
  const parsed = surfaceSchema.safeParse(attributes ?? {});
  if (!parsed.success) {
    return { surface: { question: null, last: [] }, speaker: null };
  }
  const { question, last, speaker } = parsed.data;
  // Only a ready catalog tutor is a voice; anything else in the attributes is ignored.
  const known = deps.introductions.find((intro) => intro.tutorId === speaker)?.tutorId ?? null;
  return { surface: { question: question ?? null, last: last ?? [] }, speaker: known };
}

/**
 * Fixed lines as the companion's clips, dynamic sentences in Alexa's voice, all in one
 * APL for Audio sequence. Clips are fetched in parallel under one deadline; without any clip the whole
 * reply is plain text in Alexa's voice.
 */
async function render(
  reply: ChildReply,
  speaker: TutorId,
  deps: ChildChannelDeps,
): Promise<Response> {
  const speech = reply.parts.map((part) => part.text).join(' ');
  const last = reply.parts.at(-1)?.text ?? speech;
  const tutorReply = { speech, conversation: reply.open ? 'open' : 'closed' } as const;
  const ending = {
    reprompt: last,
    sessionAttributes: { question: reply.question, last: reply.parts, speaker },
  };
  const { voice } = deps;
  const voiceDeadlineMs = Math.min(
    deps.voiceDeadlineMs ?? VOICE_DEADLINE_MS,
    CHILD_VOICE_DEADLINE_MS,
    timeLeft(deps) - RENDER_RESERVE_MS,
  );
  if (!voice || voiceDeadlineMs <= 0) {
    return speak(tutorReply, ending);
  }
  const timing = { ...deps, voiceDeadlineMs };
  const urls = await Promise.all(
    reply.parts.map((part) => clipOf(part, { speaker, voice, timing })),
  );
  if (urls.every((url) => url === null)) {
    return speak(tutorReply, ending);
  }
  const items = reply.parts.map((part, index) => {
    const url = urls[index];
    return url ? { type: 'Audio', source: url } : { type: 'Speech', content: part.text };
  });
  return renderAudio(
    tutorReply,
    { item: { type: 'Sequencer', items }, token: CHILD_VOICE_TOKEN },
    ending,
  );
}

function clipOf(
  part: SpokenPart,
  { speaker, voice, timing }: { speaker: TutorId; voice: TutorVoice; timing: VoiceTiming },
): Promise<string | null> {
  if (part.kind === 'alexa') {
    return Promise.resolve(null);
  }
  return voiced(() => voice.lineUrl(speaker, part.text), timing);
}
