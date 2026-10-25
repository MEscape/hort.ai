import { z } from 'zod';

import { renderAudio, speak, voiced } from './alexa-speech';
import { childDialog } from './child-dialog';

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
}

export interface ChildRequest {
  readonly type: 'LaunchRequest' | 'IntentRequest';
  readonly intent?: string | undefined;
  readonly utterance?: string | undefined;
  readonly attributes?: SessionAttributes | undefined;
}

interface ChildChannelDeps extends VoiceTiming {
  readonly child: ChildChannel;
  readonly introductions: readonly TutorIntroduction[];
  readonly voice: TutorVoice | null;
}

const CHILD_VOICE_TOKEN = 'child-companion';
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
  [/^(nein|nee|nö|nicht jetzt)\b/, 'no'],
  [/fütter|futter|snack|hunger/, 'feed'],
  [/level|sterne/, 'level'],
  [/was hab(e)? ich auf|welche (haus)?aufgaben|aufgaben von der schule|aufgegeben/, 'tasks'],
  [/hilfe|was kann ich/, 'help'],
  [/nochmal|noch einmal|wiederhol|wie bitte/, 'repeat'],
  [/aufgabe|antwort|tipp|ergebnis|weiter|pause|erste|zweite|dritte|nummer/, 'soon'],
];

const partSchema = z.object({
  kind: z.enum(['line', 'greeting', 'alexa']),
  text: z.string().max(MAX_PART_LENGTH),
});
/** Surface state only (rule 10): the open yes/no question and the last reply, for "Wiederholen". */
const surfaceSchema = z.object({
  question: z.literal('feed').nullable().optional(),
  last: z.array(partSchema).max(MAX_REMEMBERED_PARTS).optional(),
});

/** Maps a request onto the child dialog and its reply onto Alexa speech in the companion's voice. */
export async function respondToChild(
  request: ChildRequest,
  deps: ChildChannelDeps,
): Promise<Response> {
  const intent = request.type === 'LaunchRequest' ? 'launch' : intentOf(request);
  const surface = readSurface(request.attributes);
  const { companion, defaultTutorId } = deps.child;
  // The companion's voice comes from the profile on every turn, in parallel with the operation.
  const [own, reply] = await Promise.all([
    companion.companion(),
    childDialog(intent, surface, companion),
  ]);
  const speaker = (own.isOk() ? own.value : null) ?? defaultTutorId;
  const spoken = withGreetingOf(reply, greetingOf(deps, speaker));
  return render(spoken, speaker, deps);
}

function intentOf(request: ChildRequest): ChildIntent {
  const name = request.intent ?? '';
  const mapped = INTENTS[name];
  if (mapped !== undefined) {
    return mapped;
  }
  const words = request.utterance?.toLowerCase().trim() ?? '';
  if (words.length === 0) {
    return 'unknown';
  }
  return FREE_INPUT_RULES.find(([pattern]) => pattern.test(words))?.[1] ?? 'unknown';
}

function readSurface(attributes: SessionAttributes | undefined): DialogSurface {
  const parsed = surfaceSchema.safeParse(attributes ?? {});
  return parsed.success
    ? { question: parsed.data.question ?? null, last: parsed.data.last ?? [] }
    : { question: null, last: [] };
}

/** The catalog greeting of `tutorId` (the dialog runs before the speaker is known, so it is filled in after). */
function greetingOf(deps: ChildChannelDeps, tutorId: TutorId): string {
  return deps.introductions.find((intro) => intro.tutorId === tutorId)?.text ?? '';
}

function withGreetingOf(reply: ChildReply, greeting: string): ChildReply {
  const parts = reply.parts
    .map((part) => (part.kind === 'greeting' ? { ...part, text: greeting } : part))
    .filter((part) => part.text.length > 0);
  return { ...reply, parts };
}

/**
 * Fixed lines and the greeting as the companion's clips, dynamic sentences in Alexa's voice, all in one
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
    sessionAttributes: { question: reply.question, last: reply.parts },
  };
  const { voice } = deps;
  if (!voice) {
    return speak(tutorReply, ending);
  }
  const urls = await Promise.all(reply.parts.map((part) => clipOf(part, { speaker, voice, deps })));
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
  { speaker, voice, deps }: { speaker: TutorId; voice: TutorVoice; deps: ChildChannelDeps },
): Promise<string | null> {
  if (part.kind === 'alexa') {
    return Promise.resolve(null);
  }
  return voiced(
    () =>
      part.kind === 'greeting' ? voice.greetingUrl(speaker) : voice.lineUrl(speaker, part.text),
    deps,
  );
}
