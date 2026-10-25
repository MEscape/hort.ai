'use client';

import { useRef, useState } from 'react';

import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { TaskEntry } from './task-entry';

interface TaskScreenProps {
  readonly childProfileId: string;
}

/** The task editor of the child's home: the typed task starts a help session. */
export function TaskScreen({ childProfileId }: TaskScreenProps) {
  const t = useTranslations('app');
  const [draft, setDraft] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-safe">
      <Button asChild variant="ghost" className="self-start">
        <Link href="/home">
          <ArrowLeft aria-hidden="true" />
          {t('world.map.backHome')}
        </Link>
      </Button>
      <TaskEntry
        draft={draft}
        onDraftChange={setDraft}
        headingRef={headingRef}
        childProfileId={childProfileId}
      />
    </main>
  );
}
