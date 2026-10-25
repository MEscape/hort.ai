import { TimeoutError, clamp, withTimeout } from '@lib/utils';

import { VOICE_DEADLINE_MS, renderAudio, speak, speakable, voiced } from './alexa-speech';
import { childDialog, line, needsBackend, open, timedOutReply } from './child-dialog';
import { learningDialog } from './child-learning';
import { CHILD_LINES } from './child-lines';
import { MAX_PART_LENGTH, readSurface } from './child-surface';

import type { SessionAttributes, VoiceTiming } from './alexa-speech';
import type { ChildIntent, ChildReply, LearnIntent, PendingStep, SpokenPart } from './child-dialog';
import type { LearnRequest } from './child-learning';
import type { Surface } from './child-surface';
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
  /** Time the child's use cases (database, AI) may take in total for one turn; tests shorten it. */
  readonly backendDeadlineMs?: number;
  /**
   * Keeps a help-session step running after its turn answered "Ich überlege noch" (Next.js `after`),
   * so the step is stored when the child says "weiter".
   */
  readonly keepAlive?: (work: Promise<unknown>) => void;
  /** Told how long a help-session turn took, per part (never its words), to watch Alexa's 8 s. */
  readonly onTiming?: (timing: TurnTiming) => void;
}

export interface TurnTiming {
  readonly intent: LearnIntent;
  /** Use cases (session, AI) until the reply was known, or until the turn gave up on them. */
  readonly backendMs: number;
  /** Clips (companion voice) and rendering. */
  readonly voiceMs: number;
  readonly outcome: 'answered' | 'thinking';
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
/**
 * A help-session step asks the AI (and a new task first classifies it), so it may take longer; the
 * companion voice of its new text then needs a synthesis, hence the larger reserve. What does not
 * finish in time is answered with "Ich überlege noch, sag weiter" and kept running.
 */
const LEARN_BACKEND_DEADLINE_MS = 4_500;
const LEARN_VOICE_RESERVE_MS = 2_200;
/** The only intent of the first interaction model; its free text is mapped by keywords. */
const FREE_INPUT_INTENT = 'FreieEingabeIntent';

/** Intent names of interaction model v2 (alexa/skill-package/interactionModels/custom/de-DE.json). */
const INTENTS: Readonly<Record<string, ChildIntent>> = {
  FuetternIntent: 'feed',
  LevelIntent: 'level',
  SchulaufgabenIntent: 'tasks',
  AufgabeIntent: 'task',
  NeueAufgabeIntent: 'newTask',
  TippIntent: 'hint',
  AntwortIntent: 'answer',
  AufgabeVorlesenIntent: 'readTask',
  WeitermachenIntent: 'resume',
  AuswahlIntent: 'pick',
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
 * Free input (the catch-all `FreieEingabeIntent`) is mapped by keywords first, so the commands work
 * whatever the console's model recognises. First match wins; stopping is checked first so "tschüss"
 * always ends. Anything else is said to the companion (`learn`: a task, an answer, a reply). The words
 * are matched and handed to the help session, never logged.
 */
const FREE_INPUT_RULES: ReadonlyArray<readonly [RegExp, ChildIntent]> = [
  [/\b(tschüss|tschüs|stopp?|beenden|aufhören|ende)\b/u, 'stop'],
  [/^(ja|jawohl|jo|gerne?|okay|ok|klar)\b/u, 'yes'],
  [/^(nein|nee|nö|nicht jetzt)(?![\p{L}])/u, 'no'],
  [/\bfütter|\bfutter\b|\bsnack|\bhunger\b|\bessen\b/u, 'feed'],
  [/\blevel\b|\bsterne\b/u, 'level'],
  [/was hab(e)? ich auf|welche (haus)?aufgaben|aufgaben von der schule|aufgegeben/u, 'tasks'],
  [/hilfe|was kann ich/u, 'help'],
  [/nochmal|noch einmal|wiederhol|wie bitte/u, 'repeat'],
  [/^(weiter|weitermachen|mach weiter)$/u, 'resume'],
  [/^neue aufgabe$|^ich habe eine (neue |haus)?aufgabe$/u, 'newTask'],
  [/\b(nimm|nehme)\b.*\b(erste|zweite|dritte|vierte|fünfte|\d+)/u, 'pick'],
];
const LEARN_INTENTS: ReadonlySet<string> = new Set<LearnIntent>([
  'learn',
  'task',
  'newTask',
  'hint',
  'answer',
  'readTask',
  'resume',
  'pick',
]);
const isLearnIntent = (intent: ChildIntent): intent is LearnIntent => LEARN_INTENTS.has(intent);

/** Maps a request onto the child dialog and its reply onto Alexa speech in the companion's voice. */
export async function respondToChild(
  request: ChildRequest,
  deps: ChildChannelDeps,
): Promise<Response> {
  const intent = request.type === 'LaunchRequest' ? 'launch' : intentOf(request);
  const read = readSurface(request.attributes, deps.introductions);
  const { surface, speaker: lastSpeaker } = read;
  const { companion, defaultTutorId, backendDeadlineMs } = deps.child;
  const fallbackSpeaker = lastSpeaker ?? defaultTutorId;
  const learn = learnRequestOf(intent, read, request.utterance);
  if (learn !== null) {
    return respondLearning(learn, { deps, fallbackSpeaker });
  }
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

/**
 * The help-session intents, and "ja"/"nein"/"Hilfe" while the child is in the help session (they
 * answer the companion there, they do not end the skill or list the commands).
 */
function learnRequestOf(
  intent: ChildIntent,
  read: Surface,
  utterance: string | undefined,
): LearnRequest | null {
  const request = (learn: LearnIntent, said = utterance?.trim() ?? ''): LearnRequest => ({
    intent: learn,
    utterance: said,
    pending: read.pending,
    expectTask: read.expectTask,
  });
  if (isLearnIntent(intent)) {
    return request(intent);
  }
  if (!read.learning || read.surface.question === 'feed') {
    return null;
  }
  if (intent === 'help') {
    return request('hint');
  }
  if (intent === 'yes' || intent === 'no') {
    return request('learn', utterance?.trim() ?? (intent === 'yes' ? 'ja' : 'nein'));
  }
  return null;
}

/**
 * One help-session turn: the step under the learning deadline, then the clips. A step that does not
 * finish in time keeps running (`keepAlive`) and the child hears "Ich überlege noch, sag weiter";
 * "weiter" runs the same step (same request id) again, which the backend answers from its store.
 */
async function respondLearning(
  learnRequest: LearnRequest,
  { deps, fallbackSpeaker }: { deps: ChildChannelDeps; fallbackSpeaker: TutorId },
): Promise<Response> {
  const { companion, backendDeadlineMs, keepAlive, onTiming } = deps.child;
  const startedAt = deps.now();
  const planned: { step?: PendingStep } = {};
  const work = Promise.all([
    Promise.resolve(companion.companion()),
    learningDialog(learnRequest, companion, (step) => {
      planned.step = step;
    }),
  ]);
  let reply: ChildReply;
  let speaker = fallbackSpeaker;
  try {
    const [own, answered] = await withTimeout(
      work,
      clamp(
        timeLeft(deps) - LEARN_VOICE_RESERVE_MS,
        0,
        backendDeadlineMs ?? LEARN_BACKEND_DEADLINE_MS,
      ),
    );
    reply = answered;
    speaker = (own.isOk() ? own.value : null) ?? fallbackSpeaker;
  } catch (thrown) {
    if (!(thrown instanceof TimeoutError)) {
      throw thrown;
    }
    keepAlive?.(work.catch(() => undefined));
    reply =
      planned.step === undefined
        ? open([line(CHILD_LINES.notNow)])
        : { ...open([line(CHILD_LINES.thinking)]), pending: planned.step };
  }
  const backendMs = deps.now() - startedAt;
  const response = await render(reply, speaker, deps, true);
  onTiming?.({
    intent: learnRequest.intent,
    backendMs,
    voiceMs: deps.now() - startedAt - backendMs,
    outcome: reply.pending === undefined ? 'answered' : 'thinking',
  });
  return response;
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
  return FREE_INPUT_RULES.find(([pattern]) => pattern.test(words))?.[1] ?? 'learn';
}

/** A part as Alexa says it in its own voice: a help-session text with its signs as words. */
function spokenText(part: SpokenPart): string {
  return part.kind === 'line' ? part.text : speakable(part.text);
}

/**
 * Fixed lines and help-session texts as the companion's clips, other dynamic sentences in Alexa's
 * voice, all in one APL for Audio sequence. Clips are fetched in parallel under one deadline; a part
 * without its clip is spoken by Alexa, and without any clip the whole reply is plain text.
 */
async function render(
  reply: ChildReply,
  speaker: TutorId,
  deps: ChildChannelDeps,
  learning = false,
): Promise<Response> {
  const speech = reply.parts.map(spokenText).join(' ');
  const lastPart = reply.parts.at(-1);
  const tutorReply = { speech, conversation: reply.open ? 'open' : 'closed' } as const;
  // "Wiederholen" speaks a help-session text again in Alexa's voice: only fixed lines have clips.
  const remembered = reply.parts.map((part) =>
    part.kind === 'line'
      ? part
      : { kind: 'alexa', text: spokenText(part).slice(0, MAX_PART_LENGTH) },
  );
  const ending = {
    reprompt: reply.reprompt ?? (lastPart ? spokenText(lastPart) : speech),
    sessionAttributes: {
      question: reply.question,
      last: remembered,
      speaker,
      ...(learning ? { learning } : {}),
      ...(reply.expectTask === true ? { expectTask: true } : {}),
      ...(reply.pending === undefined ? {} : { pending: reply.pending }),
    },
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
    reply.parts.map((part) => clipOf(part, { speaker, voice, timing, deps })),
  );
  if (urls.every((url) => url === null)) {
    return speak(tutorReply, ending);
  }
  const items = reply.parts.map((part, index) => {
    const url = urls[index];
    return url ? { type: 'Audio', source: url } : { type: 'Speech', content: spokenText(part) };
  });
  return renderAudio(
    tutorReply,
    { item: { type: 'Sequencer', items }, token: CHILD_VOICE_TOKEN },
    ending,
  );
}

function clipOf(
  part: SpokenPart,
  {
    speaker,
    voice,
    timing,
    deps,
  }: { speaker: TutorId; voice: TutorVoice; timing: VoiceTiming; deps: ChildChannelDeps },
): Promise<string | null> {
  switch (part.kind) {
    case 'alexa':
      return Promise.resolve(null);
    case 'tutor':
      // The words are found again in the stored session; the voice is the child's own companion.
      return voiced(() => deps.child.companion.tutorVoice(part.message), timing);
    case 'line':
      return voiced(() => voice.lineUrl(speaker, part.text), timing);
  }
}
