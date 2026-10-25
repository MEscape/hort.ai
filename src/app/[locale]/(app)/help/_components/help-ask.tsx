'use client';

import { useState } from 'react';

import { ChildSchoolTasks } from '@modules/assignments/client';
import type { ChildAssignmentView } from '@modules/assignments/client';
import type { TutorOption } from '@modules/learner/client';

import { Stage } from '@components/shared/stage';
import { StageCompanion } from '@components/shared/stage-companion';

import { useTranslations } from '@i18n/client';

import { StartAssignmentHelp } from './start-assignment-help';
import { TaskEntry } from './task-entry';

import type { OpenTask } from './replace-open-task';
import type { StartTopic } from './task-entry';

export type { OpenTask } from './replace-open-task';
export type { StartTopic } from './task-entry';

/** The three phases of a help session; asking for the task is the first. */
const PHASE_COUNT = 3;

interface HelpAskProps {
  readonly childProfileId: string;
  readonly companion: TutorOption;
  /** The child's open task, when a new one was asked for while it is still open. */
  readonly openTask: OpenTask | null;
  /** The island the child came from (`?area=&place=`), validated on the server. */
  readonly topic: StartTopic | null;
  /** The class's assignments, or `null` when none can be shown. */
  readonly assignments: readonly ChildAssignmentView[] | null;
  /** What the parent stored: dictation only with it. */
  readonly voiceConsent?: boolean;
}

/**
 * The help screen before there is a task: the same canvas stage as the session, the companion asks
 * for the task, the child writes it (or picks one of the teacher's assignments), and the screen
 * turns into the session. There is no separate start page any more.
 */
export function HelpAsk({
  childProfileId,
  companion,
  openTask,
  topic,
  assignments,
  voiceConsent = false,
}: HelpAskProps) {
  const t = useTranslations('app');
  const [draft, setDraft] = useState('');
  return (
    <Stage
      title={t('start.entry.title')}
      current={1}
      total={PHASE_COUNT}
      progressLabel={t('start.ask.progress')}
      companion={<StageCompanion companion={companion} mascot="curious" beat={0} />}
      line={t('start.ask.line')}
    >
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <TaskEntry
          draft={draft}
          onDraftChange={setDraft}
          childProfileId={childProfileId}
          openTask={openTask}
          topic={topic}
          voiceConsent={voiceConsent}
        />
        {assignments !== null && assignments.length > 0 && (
          <ChildSchoolTasks
            assignments={assignments}
            startHelp={(assignment) => (
              <StartAssignmentHelp
                childProfileId={childProfileId}
                assignmentId={assignment.id}
                openTask={openTask}
              />
            )}
          />
        )}
      </div>
    </Stage>
  );
}
