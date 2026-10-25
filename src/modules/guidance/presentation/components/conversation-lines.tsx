'use client';

import type { TutorOption } from '@modules/learner/client';

import { Character } from '@components/brand/character';

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
function companionText(line: Exclude<ConversationLine, { kind: 'child' }>, t: GuidanceT): string {
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

interface ConversationLinesProps {
  readonly lines: readonly ConversationLine[];
  readonly companion: TutorOption;
}

/** The conversation, oldest first: the companion speaks with picture and name, the child's own words on the right. */
export function ConversationLines({ lines, companion }: ConversationLinesProps) {
  const t = useTranslations('guidance');
  return (
    <ol aria-label={t('conversation.label')} aria-live="polite" className="space-y-4">
      {lines.map((line) =>
        line.kind === 'child' ? (
          <li key={line.id} className="flex justify-end">
            <p className="max-w-md rounded-token-lg bg-primary-subtle p-4 whitespace-pre-wrap text-copy">
              <span className="sr-only">{t('conversation.you')}: </span>
              {line.text}
            </p>
          </li>
        ) : (
          <li key={line.id} className="flex items-start gap-3">
            <Character
              imageUrl={companion.imageUrl}
              openImageUrl={companion.imageOpenUrl}
              face={companion.face}
              openAlignment={companion.openAlignment}
              alt=""
              className="size-14 shrink-0"
            />
            <div className="rounded-token-lg bg-surface p-4 text-copy shadow-sm">
              <p className="mb-1 font-semibold">{companion.name}</p>
              <p className="whitespace-pre-wrap">{companionText(line, t)}</p>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
