import type { AnswerFeedback, FeedbackText, HelpSessionView, HintStep } from '@modules/guidance';

import { notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { getPath } from '@lib/utils';

import type {
  ChildLearning,
  NewTask,
  OpenHelp,
  TutorMessage,
  TutorText,
} from '../../domain/ports/child-companion.port';

/** Runs one use-case call inside the child channel scope (see `demoChildCompanion`). */
export type ChannelRunner = <T>(work: () => Promise<AppResult<T>>) => AppResultAsync<T>;

/** Words that make a spoken task a maths task; anything else is grounded as general studies. */
const MATH_TASK =
  /\d|geteilt|mal\b|plus|minus|rechne|zahl|ergebnis|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn/u;

/**
 * The web's help session (guidance) for the bound child: the same use cases, run in the child channel,
 * so they authorize, budget, validate and store every step as for the web. Texts are the validated AI
 * text or the predefined catalog wording the web shows (`guidance.*`, German); nothing is invented here.
 * A clip of a text is issued by the voice module's read-aloud ticket (it finds the words in the stored
 * session again and checks the guardian's voice consent) and hosted as a clip for Alexa.
 */
export function guidanceChildLearning(
  inChannel: ChannelRunner,
  childProfileId: string,
): ChildLearning {
  const guidance = () => import('@modules/guidance');
  const openSession = () =>
    guidance().then(({ getHelpSessionQueries }) =>
      getHelpSessionQueries().getOpenHelpSession.execute({ childProfileId }),
    );

  const nextHintIn = async (sessionId: string, requestId: string) => {
    const { getGuidanceCommands, deGuidance } = await guidance();
    return getGuidanceCommands()
      .requestHint.execute({ childProfileId, sessionId, requestId })
      .map((step) => hintText(step, wordingOf(deGuidance.guidance)));
  };

  return {
    openHelp: () => inChannel(async () => (await openSession()).map(toOpenHelp)),
    startHelp: (task, requestId) =>
      inChannel(async () => {
        const { getHelpSessionCommands, deGuidance } = await guidance();
        const source = await taskSource(task, childProfileId);
        if (source === null) {
          return errAsync(notFoundError('alexa.assignment_not_found', 'No such assignment.'));
        }
        const started = await getHelpSessionCommands().startHelpSession.execute({
          childProfileId,
          ...source,
        });
        if (started.isErr()) {
          return errAsync(started.error);
        }
        const { session } = started.value;
        const opening = openingText(session, wordingOf(deGuidance.guidance));
        return opening === null ? nextHintIn(session.sessionId, requestId) : okAsync(opening);
      }),
    nextHint: (sessionId, requestId) => inChannel(() => nextHintIn(sessionId, requestId)),
    checkAnswer: (sessionId, requestId, answer) =>
      inChannel(async () => {
        const { getGuidanceCommands, deGuidance } = await guidance();
        return getGuidanceCommands()
          .checkAnswer.execute({ childProfileId, sessionId, requestId, answer })
          .map((feedback) => answerTexts(feedback, wordingOf(deGuidance.guidance)));
      }),
    replyToQuestion: (sessionId, reply) =>
      inChannel(async () => {
        const { getHelpSessionCommands } = await guidance();
        return getHelpSessionCommands()
          .replyToComprehensionQuestion.execute({ childProfileId, sessionId, reply })
          .map(({ status }) => ({ understood: status === 'understood' }));
      }),
    tutorVoice: (message) =>
      inChannel(async () => {
        // Guidance loads first: its module must be settled before the parallel loads below reuse it.
        const { deGuidance } = await guidance();
        const [{ getVoiceQueries, getHostedSpeech }, open] = await Promise.all([
          import('@modules/voice'),
          openSession(),
        ]);
        if (open.isErr()) {
          return errAsync(open.error);
        }
        const ref = open.value === null ? null : messageRef(open.value, message);
        if (ref === null) {
          return errAsync(notFoundError('alexa.message_not_found', 'No such message.'));
        }
        return getVoiceQueries()
          .issueReadAloudTicket.execute({
            childProfileId,
            message: ref,
            wording: wordingOf(deGuidance.guidance),
          })
          .andThen(({ ticket, speakerId }) =>
            getHostedSpeech().execute({
              speakerId,
              source: { kind: 'ticket', ticket, childProfileId },
            }),
          )
          .map((clip) => clip.url);
      }),
  };
}

/**
 * The open session the channel continues. An understood session is done, and one that only opened
 * (a clarifying question or small talk, no hint and no answer yet) waits for the real task: for both
 * the child's next words are a new task.
 */
function toOpenHelp(session: HelpSessionView | null): OpenHelp | null {
  if (session === null || session.status === 'understood') {
    return null;
  }
  const onlyOpened =
    session.opening !== null && session.hints.length === 0 && session.answerChecks.length === 0;
  return onlyOpened
    ? null
    : { sessionId: session.sessionId, status: session.status, task: session.task };
}

/** Which assignment or own text a spoken task names; `null` for an assignment position that does not exist. */
async function taskSource(
  task: NewTask,
  childProfileId: string,
): Promise<{ task?: string; assignmentId?: string; subject: string } | null> {
  const { assignmentsQueries } = await import('@modules/assignments');
  const listed = await assignmentsQueries.listChildAssignments.execute(childProfileId);
  const assignments = listed.isOk() ? listed.value : [];
  const spoken = task.kind === 'own' ? task.text.toLowerCase() : '';
  const assignment =
    task.kind === 'assignment'
      ? assignments[task.position - 1]
      : assignments.find((item) => {
          const title = item.title.trim().toLowerCase();
          return title.length > 0 && spoken.includes(title);
        });
  if (assignment !== undefined) {
    return { assignmentId: assignment.id, subject: subjectOf(assignment.taskText) };
  }
  return task.kind === 'own' ? { task: task.text, subject: subjectOf(task.text) } : null;
}

function subjectOf(text: string): string {
  return MATH_TASK.test(text.toLowerCase()) ? 'math' : 'general_studies';
}

type Wording = (key: string) => string;

/** A key of the guidance catalog (`hint.fallback.next_step`) in German, as the child reads it on the web. */
function wordingOf(catalog: unknown): Wording {
  return (key) => {
    const text = getPath(catalog, key);
    return typeof text === 'string' ? text : '';
  };
}

function hintText({ hint }: HintStep, wording: Wording): TutorText {
  return {
    text: hint.kind === 'generated' ? hint.text : wording(`hint.fallback.${hint.level}`),
    message: 'latest_hint',
  };
}

function openingText(session: HelpSessionView, wording: Wording): TutorText | null {
  const { opening } = session;
  if (opening === null) {
    return null;
  }
  const key = opening.kind === 'clarify' ? 'opening.clarify' : `opening.redirect.${opening.intent}`;
  return { text: wording(key), message: 'opening' };
}

function answerTexts(feedback: AnswerFeedback, wording: Wording) {
  if (feedback.result === 'correct') {
    return {
      correct: true,
      says: [
        {
          text: feedbackText(feedback.praise, wording, 'feedback.fallback.praise'),
          message: 'latest_feedback',
        },
        {
          text: feedbackText(
            feedback.question,
            wording,
            'feedback.fallback.comprehension_question',
          ),
          message: 'question',
        },
      ] satisfies TutorText[],
    };
  }
  const key = `feedback.fallback.answer_assessment.${feedback.result ?? 'unassessed'}`;
  return {
    correct: false,
    says: [
      { text: feedbackText(feedback.message, wording, key), message: 'latest_feedback' },
    ] satisfies TutorText[],
  };
}

function feedbackText(text: FeedbackText, wording: Wording, fallbackKey: string): string {
  return text.kind === 'generated' ? text.text : wording(fallbackKey);
}

/** The voice module's name of a stored message (`CompanionMessageRef`), or `null` when there is none. */
function messageRef(session: HelpSessionView, message: TutorMessage) {
  const { sessionId } = session;
  switch (message) {
    case 'latest_hint':
      return session.hints.length === 0
        ? null
        : { sessionId, kind: 'hint' as const, index: session.hints.length - 1 };
    case 'latest_feedback':
      return session.answerChecks.length === 0
        ? null
        : { sessionId, kind: 'answer_feedback' as const, index: session.answerChecks.length - 1 };
    case 'question':
      return { sessionId, kind: 'question' as const };
    case 'opening':
      return { sessionId, kind: 'opening' as const };
  }
}
