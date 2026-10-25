'use client';

import { ReadAloudButton } from '@modules/voice/client';

import { TranscriptLine } from '@components/shared/side-panel';

import { useTranslations } from '@i18n/client';

import type { ConversationLine } from '../hooks/use-help-conversation';

type GuidanceT = ReturnType<typeof useTranslations<'guidance'>>;

const HINT_FALLBACK_KEY = {
  understand_task: 'hint.fallback.understand_task',
  activate_prior_knowledge: 'hint.fallback.activate_prior_knowledge',
  next_step: 'hint.fallback.next_step',
  similar_example: 'hint.fallback.similar_example',
} as const;

const ASSESSMENT_FALLBACK_KEY = {
  partly_correct: 'feedback.fallback.answer_assessment.partly_correct',
  not_yet: 'feedback.fallback.answer_assessment.not_yet',
  unassessed: 'feedback.fallback.answer_assessment.unassessed',
} as const;

/** Validated AI text as it came, or the predefined, translated text of its kind. Never anything else. */
export function companionText(
  line: Exclude<ConversationLine, { kind: 'child' }>,
  t: GuidanceT,
): string {
  if (line.kind === 'hint') {
    return line.hint.kind === 'generated' ? line.hint.text : t(HINT_FALLBACK_KEY[line.hint.level]);
  }
  if (line.text.kind === 'generated') {
    return line.text.text;
  }
  switch (line.text.feedback) {
    case 'praise':
      return t('feedback.fallback.praise');
    case 'comprehension_question':
      return t('feedback.fallback.comprehension_question');
    case 'answer_assessment':
      return t(ASSESSMENT_FALLBACK_KEY[line.result ?? 'unassessed']);
  }
}

interface ConversationTranscriptProps {
  readonly lines: readonly ConversationLine[];
  readonly companionName: string;
  readonly childProfileId: string;
  /** What the parent stored; without it no line can be read aloud. */
  readonly voiceConsent: boolean;
}

/** The conversation as side-panel lines, oldest first: the companion on the left, the child's own words on the right. */
export function ConversationTranscript({
  lines,
  companionName,
  childProfileId,
  voiceConsent,
}: ConversationTranscriptProps) {
  const t = useTranslations('guidance');
  return lines.map((line) => (
    <TranscriptLine
      key={line.id}
      who={line.kind === 'child' ? 'child' : 'companion'}
      speaker={line.kind === 'child' ? t('conversation.you') : companionName}
      text={line.kind === 'child' ? line.text : companionText(line, t)}
      action={
        line.kind === 'child' ? undefined : (
          <ReadAloudButton
            childProfileId={childProfileId}
            message={line.speech}
            allowed={voiceConsent}
          />
        )
      }
    />
  ));
}
