import type { AppError } from '@lib/errors';
import type { AppResult } from '@lib/result';

import { CHILD_LINES } from './child-lines';
import { alexa, askWhatNow, line, open } from './child-dialog';

import type { ChildReply, LearnIntent, PendingStep, SpokenPart } from './child-dialog';
import type {
  AnswerChecked,
  ChildCompanion,
  OpenHelp,
  TutorText,
} from '../../application/contracts/child-companion-model';

export interface LearnRequest {
  readonly intent: LearnIntent;
  /** What the child said (slot text), trimmed; empty when the intent has no free text. */
  readonly utterance: string;
  /** The step of the previous turn that did not finish in time, from the session attributes. */
  readonly pending: PendingStep | null;
  /** The previous reply asked for a new task: the child's words are that task. */
  readonly expectTask: boolean;
}

/** A number in digits or as a German number word: the child is answering. */
const ANSWER = new RegExp(
  String.raw`\d|\b(null|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|` +
    String.raw`\w+zehn|zwanzig|dreißig|\w+zig|hundert|tausend|halb|hälfte)\b`,
  'u',
);
/** Asking for help: the next rung of the hint ladder. */
const HELP = /tipp|hilf|hilfe|weiß (es |das )?nicht|weiss nicht|nicht weiter|keine ahnung|versteh/u;
/** A bare yes or no without a task to talk about. */
const BARE_REPLY = /^(ja|nein|nee|nö|okay|ok|gut|klar)\b/u;

/** Steps still running on this instance by request id, so "weiter" joins one instead of starting twice. */
const running = new Map<string, Promise<ChildReply>>();

/** Spoken positions of a teacher's assignment ("nimm die zweite"); digits are read as they are. */
const POSITIONS = ['erst', 'zweit', 'dritt', 'viert', 'fünft'] as const;

const tutor = ({ text, message }: TutorText): SpokenPart => ({ kind: 'tutor', text, message });
const ASK_TASK: ChildReply = { ...open([line(CHILD_LINES.askTask)]), expectTask: true };

/**
 * The help session on Alexa: the child's words go to the web's session use
 * cases, which keep the session, decide every hint, check every answer and never reveal a solution.
 * Without an open session the words are the task; while working, a number is an answer and a call for
 * help asks for the next hint (anything else encourages without spending one); after a correct answer
 * the words reply to the comprehension question. `onPlanned` learns the step before it runs, so a turn
 * that runs out of time can offer "weiter" for exactly that step.
 */
export async function learningDialog(
  request: LearnRequest,
  companion: ChildCompanion,
  onPlanned: (step: PendingStep) => void,
): Promise<ChildReply> {
  if (request.intent === 'newTask') {
    return ASK_TASK;
  }
  const session = await companion.openHelp();
  if (session.isErr()) {
    return failed(session.error);
  }
  const resumed = request.intent === 'resume' ? request.pending : null;
  const next = resumed ?? planOrReply(request, session.value);
  if ('parts' in next) {
    return next;
  }
  onPlanned(next);
  const already = running.get(next.requestId);
  if (already !== undefined) {
    return already;
  }
  const step = runStep(next, session.value, companion).finally(() => {
    running.delete(next.requestId);
  });
  running.set(next.requestId, step);
  return step;
}

/** The step a turn asks for, or the reply when it needs none. */
function planOrReply(request: LearnRequest, session: OpenHelp | null): PendingStep | ChildReply {
  const { intent, utterance, expectTask } = request;
  const words = utterance.toLowerCase();
  const step = (op: PendingStep['op'], text = ''): PendingStep => ({
    op,
    requestId: crypto.randomUUID(),
    text,
  });
  if (intent === 'task' || (expectTask && intent === 'learn' && utterance.length > 0)) {
    return utterance.length > 0 ? step('start', utterance) : ASK_TASK;
  }
  if (intent === 'pick') {
    return utterance.length > 0 ? step('pick', utterance) : open([line(CHILD_LINES.pickTask)]);
  }
  if (session === null) {
    const noTask =
      utterance.length === 0 || BARE_REPLY.test(words) || intent === 'hint' || intent === 'answer';
    return noTask ? ASK_TASK : step('start', utterance);
  }
  if (intent === 'readTask' || (intent === 'resume' && session.status === 'working')) {
    const intro = intent === 'readTask' ? CHILD_LINES.yourTask : CHILD_LINES.goOn;
    return open([line(intro), alexa(session.task), line(CHILD_LINES.answerOrHint)]);
  }
  if (session.status === 'awaiting_comprehension_reply') {
    return utterance.length === 0 || intent === 'resume' || intent === 'hint'
      ? open([line(CHILD_LINES.explain)])
      : step('reply', utterance);
  }
  if (intent === 'hint' || HELP.test(words)) {
    return step('hint');
  }
  if ((intent === 'answer' || intent === 'learn') && ANSWER.test(words)) {
    return step('check', utterance);
  }
  return open([line(CHILD_LINES.encourage), line(CHILD_LINES.answerOrHint)]);
}

async function runStep(
  step: PendingStep,
  session: OpenHelp | null,
  companion: ChildCompanion,
): Promise<ChildReply> {
  if (step.op === 'start' || step.op === 'pick') {
    const task =
      step.op === 'start'
        ? ({ kind: 'own', text: step.text } as const)
        : ({ kind: 'assignment', position: positionOf(step.text) } as const);
    return said(await companion.startHelp(task, step.requestId));
  }
  if (session === null) {
    return ASK_TASK;
  }
  if (step.op === 'hint') {
    return said(await companion.nextHint(session.sessionId, step.requestId));
  }
  if (step.op === 'reply') {
    const replied = await companion.replyToQuestion(session.sessionId, step.text);
    if (replied.isErr()) {
      return failed(replied.error);
    }
    return replied.value.understood
      ? askWhatNow(line(CHILD_LINES.understood))
      : open([line(CHILD_LINES.thanks), line(CHILD_LINES.answerOrHint)]);
  }
  return checked(await companion.checkAnswer(session.sessionId, step.requestId, step.text));
}

function said(result: AppResult<TutorText>): ChildReply {
  if (result.isErr()) {
    return failed(result.error);
  }
  return { ...open([tutor(result.value)]), reprompt: CHILD_LINES.answerOrHint };
}

function checked(result: AppResult<AnswerChecked>): ChildReply {
  if (result.isErr()) {
    return failed(result.error);
  }
  const { correct, says } = result.value;
  const reply = open(says.map(tutor));
  return correct ? reply : { ...reply, reprompt: CHILD_LINES.answerOrHint };
}

/** "die zweite", "2" or "2." as 2; anything else as the first. */
function positionOf(text: string): number {
  const digits = /\d+/u.exec(text);
  if (digits !== null) {
    return Number(digits[0]);
  }
  const words = text.toLowerCase();
  return POSITIONS.findIndex((stem) => words.includes(stem)) + 1 || 1;
}

/** A failed step is a calm sentence of the companion, never an error message. */
function failed(error: AppError): ChildReply {
  switch (error.kind) {
    case 'rate_limited':
      return open([line(CHILD_LINES.restNow)]);
    case 'not_found':
      return open([line(CHILD_LINES.noAssignment), line(CHILD_LINES.askTask)]);
    case 'validation':
      return open([line(CHILD_LINES.notUnderstood)]);
    default:
      return open([line(CHILD_LINES.learnFailed)]);
  }
}
