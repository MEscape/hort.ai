'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { StartChoices } from './start-choices';
import { StartEmptyState } from './start-empty-state';
import { TaskEntry } from './task-entry';

type StartView = 'home' | 'task' | 'school' | 'continue';
const BACK_ARROW = '←';

/** Drafts live only in this mounted route; leaving or reloading it clears them. */
export function StartScreen() {
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
        variant="ghost"
        onClick={() => {
          handleNavigate('home');
        }}
      >
        <span aria-hidden="true">{BACK_ARROW}</span>
        {t('start.back')}
      </Button>
      {view === 'task' ? (
        <TaskEntry draft={draft} onDraftChange={setDraft} headingRef={headingRef} />
      ) : (
        <StartEmptyState kind={view} headingRef={headingRef} />
      )}
    </div>
  );
}
