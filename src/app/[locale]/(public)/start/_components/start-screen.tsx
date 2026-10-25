'use client';

import { useEffect, useRef, useState } from 'react';

import { ChildSchoolTasks } from '@modules/assignments/client';
import type { ChildAssignmentView } from '@modules/assignments/client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { StartAssignmentHelp } from './start-assignment-help';
import { StartChoices } from './start-choices';
import { StartEmptyState } from './start-empty-state';
import { TaskEntry } from './task-entry';

type StartView = 'home' | 'task' | 'school' | 'continue';
const BACK_ARROW = '←';

interface StartScreenProps {
  /** The child's class's assignments (child-safe views), or `null` when none can be shown. */
  readonly schoolAssignments: readonly ChildAssignmentView[] | null;
  readonly childProfileId?: string | null;
  readonly voiceConsent?: boolean;
}

/** Drafts live only in this mounted route; leaving or reloading it clears them. */
export function StartScreen({
  schoolAssignments,
  childProfileId,
  voiceConsent = false,
}: StartScreenProps) {
  const t = useTranslations('app');
  const [view, setView] = useState<StartView>('home');
  const [draft, setDraft] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (hasNavigated.current) {
      if (view === 'home') {
        primaryActionRef.current?.focus();
      } else {
        headingRef.current?.focus();
      }
    }
  }, [view]);

  function handleNavigate(nextView: StartView) {
    hasNavigated.current = true;
    setView(nextView);
  }

  return view === 'home' ? (
    <StartChoices onSelect={handleNavigate} primaryActionRef={primaryActionRef} />
  ) : (
    <div className="mx-auto mt-6 max-w-3xl space-y-5 sm:mt-10">
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          handleNavigate('home');
        }}
      >
        <span aria-hidden="true">{BACK_ARROW}</span>
        {t('start.back')}
      </Button>
      {view === 'task' && (
        <TaskEntry
          draft={draft}
          onDraftChange={setDraft}
          headingRef={headingRef}
          childProfileId={childProfileId ?? null}
          voiceConsent={voiceConsent}
        />
      )}
      {view === 'school' && schoolAssignments !== null && (
        <ChildSchoolTasks
          assignments={schoolAssignments}
          startHelp={
            childProfileId === null || childProfileId === undefined
              ? undefined
              : (assignment) => (
                  <StartAssignmentHelp
                    childProfileId={childProfileId}
                    assignmentId={assignment.id}
                  />
                )
          }
        />
      )}
      {((view === 'school' && schoolAssignments === null) || view === 'continue') && (
        <StartEmptyState kind={view} headingRef={headingRef} />
      )}
    </div>
  );
}
