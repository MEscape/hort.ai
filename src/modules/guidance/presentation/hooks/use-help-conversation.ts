'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import type { CompanionMessageRef } from '@modules/voice/client';

import { checkAnswerAction } from '../actions/check-answer-action';
import { replyComprehensionAction } from '../actions/reply-comprehension-action';
import { requestHintAction } from '../actions/request-hint-action';

import type { FeedbackText } from '../../application/contracts/answer-views';
import type { HintOutcome } from '../../application/contracts/hint-views';
import type { HelpSessionDto } from '../dto/guidance-dto';

/** One line of the conversation, built only from what the backend returned. */
export type ConversationLine =
  | {
      readonly id: string;
      readonly kind: 'hint';
      readonly hint: HintOutcome;
      readonly speech: CompanionMessageRef;
    }
  | {
      readonly id: string;
      readonly kind: 'feedback';
      readonly speech: CompanionMessageRef;
      readonly text: FeedbackText;
      /** For predefined encouragement: how the answer was assessed, `null` when it could not be. */
      readonly result: 'partly_correct' | 'not_yet' | null;
    }
  | { readonly id: string; readonly kind: 'child'; readonly text: string };

export type ConversationPhase = 'working' | 'comprehension' | 'understood';

/** What went wrong on the last step: a backend code, `empty` for an empty draft, `null` offline. */
export interface StepFailure {
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;
}

type Step = 'hint' | 'answer' | 'reply';

/** The thinking prompt that opens a session has a fixed key, so a reload never asks twice. */
const OPENING_REQUEST_ID = 'opening';

function phaseOf(status: HelpSessionDto['status']): ConversationPhase {
  if (status === 'understood') {
    return 'understood';
  }
  return status === 'awaiting_comprehension_reply' ? 'comprehension' : 'working';
}

function initialLines(session: HelpSessionDto): ConversationLine[] {
  const hints = session.hints.map((hint, index): ConversationLine => ({
    id: `hint-${index}`,
    kind: 'hint',
    hint,
    speech: { kind: 'hint', index, sessionId: session.sessionId },
  }));
  return session.openQuestion === null
    ? hints
    : [
        ...hints,
        {
          id: 'question',
          kind: 'feedback',
          text: session.openQuestion,
          result: null,
          speech: {
            kind: 'answer_question',
            index: session.answerChecks.length - 1,
            sessionId: session.sessionId,
          },
        },
      ];
}

/**
 * The help conversation of one stored session (#83). The browser keeps no session state of its
 * own: it starts from the stored session and adds only what each Server Action returned. Every
 * step carries a request id made once per intent (step and text) and reused on retry, so a double
 * tap or a retry after a lost answer is stored once.
 */
export function useHelpConversation(childProfileId: string, initial: HelpSessionDto) {
  const sessionId = initial.sessionId;
  const [lines, setLines] = useState(() => initialLines(initial));
  const [phase, setPhase] = useState(() => phaseOf(initial.status));
  const [hintCount, setHintCount] = useState(initial.hints.length);
  const [draft, setDraft] = useState('');
  const [failure, setFailure] = useState<StepFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  const pending = useRef<{ step: Step; requestId: string; text: string } | null>(null);
  const lastStep = useRef<Step>('hint');
  const opened = useRef(false);
  const nextHint = useRef(initial.hints.length);
  const nextAnswer = useRef(initial.answerChecks.length);

  const fail = (error: { code: string; retryAfterSeconds?: number } | undefined) => {
    setFailure({ code: error?.code ?? null, retryAfterSeconds: error?.retryAfterSeconds ?? null });
  };

  const add = (...added: ConversationLine[]) => {
    setLines((current) => [...current, ...added]);
  };

  const askHint = (requestId: string) => {
    startTransition(async () => {
      const result = await requestHintAction({ childProfileId, sessionId, requestId }).catch(
        () => null,
      );
      if (result?.ok !== true) {
        fail(result?.error);
        return;
      }
      pending.current = null;
      setHintCount((count) => count + 1);
      add({
        id: `hint-${requestId}`,
        kind: 'hint',
        hint: result.data.hint,
        speech: { kind: 'hint', index: nextHint.current++, sessionId },
      });
    });
  };

  const checkAnswer = (requestId: string, answer: string) => {
    startTransition(async () => {
      const result = await checkAnswerAction({
        childProfileId,
        sessionId,
        requestId,
        answer,
      }).catch(() => null);
      if (result?.ok !== true) {
        fail(result?.error);
        return;
      }
      pending.current = null;
      setDraft('');
      const feedback = result.data;
      const answerIndex = nextAnswer.current++;
      const own: ConversationLine = { id: `answer-${requestId}`, kind: 'child', text: answer };
      if (feedback.result === 'correct') {
        setPhase('comprehension');
        add(
          own,
          {
            id: `praise-${requestId}`,
            kind: 'feedback',
            text: feedback.praise,
            result: null,
            speech: { kind: 'answer_feedback', index: answerIndex, sessionId },
          },
          {
            id: `question-${requestId}`,
            kind: 'feedback',
            text: feedback.question,
            result: null,
            speech: { kind: 'answer_question', index: answerIndex, sessionId },
          },
        );
        return;
      }
      add(own, {
        id: `message-${requestId}`,
        kind: 'feedback',
        text: feedback.message,
        speech: { kind: 'answer_feedback', index: answerIndex, sessionId },
        result: feedback.result,
      });
    });
  };

  const sendReply = (requestId: string, reply: string) => {
    startTransition(async () => {
      const result = await replyComprehensionAction({
        childProfileId,
        sessionId,
        reply,
      }).catch(() => null);
      if (result?.ok !== true) {
        fail(result?.error);
        return;
      }
      pending.current = null;
      setDraft('');
      add({ id: `reply-${requestId}`, kind: 'child', text: reply });
      setPhase(phaseOf(result.data.status));
    });
  };

  const run = (step: Step) => {
    if (isPending) {
      return;
    }
    if (step !== 'hint' && draft.trim().length === 0) {
      setFailure({ code: 'empty', retryAfterSeconds: null });
      return;
    }
    setFailure(null);
    lastStep.current = step;
    // A changed answer or reply is a new intent: the old id would replay the old one's result.
    const text = step === 'hint' ? '' : draft;
    if (pending.current?.step !== step || pending.current.text !== text) {
      pending.current = { step, requestId: crypto.randomUUID(), text };
    }
    const { requestId } = pending.current;
    if (step === 'hint') {
      askHint(requestId);
    } else if (step === 'answer') {
      checkAnswer(requestId, draft);
    } else {
      sendReply(requestId, draft);
    }
  };

  // The session opens with the thinking prompt of `understand_task`, asked for once per mount;
  // its fixed id makes a reload or a retry return the stored prompt instead of a second one.
  useEffect(() => {
    if (
      opened.current ||
      initial.hints.length > 0 ||
      initial.opening !== null ||
      phaseOf(initial.status) !== 'working'
    ) {
      return;
    }
    opened.current = true;
    pending.current = { step: 'hint', requestId: OPENING_REQUEST_ID, text: '' };
    askHint(OPENING_REQUEST_ID);
  }, []);

  return {
    lines,
    phase,
    /** The opening thinking prompt is not a hint the child asked for. */
    hintsUsed: Math.max(0, hintCount - (initial.opening === null ? 1 : 0)),
    draft,
    setDraft,
    failure,
    isPending,
    askForHint: () => {
      run('hint');
    },
    submitAnswer: () => {
      run('answer');
    },
    submitReply: () => {
      run('reply');
    },
    retry: () => {
      run(lastStep.current);
    },
  };
}

export type HelpConversationState = ReturnType<typeof useHelpConversation>;
