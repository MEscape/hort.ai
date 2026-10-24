'use client';

import { useState } from 'react';

import { FeedbackPanel } from '@components/shared/feedback-panel';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

const HINT_KEYS = [
  'designSystem.lesson.hint1',
  'designSystem.lesson.hint2',
  'designSystem.lesson.hint3',
] as const;

function CompanionSketch() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary bg-accent shadow-glow"
    >
      <span className="absolute -top-4 left-12 h-8 w-5 -rotate-45 rounded-full bg-secondary" />
      <div className="flex gap-5">
        <span className="h-3 w-3 rounded-full bg-primary" />
        <span className="h-3 w-3 rounded-full bg-primary" />
      </div>
      <span className="absolute bottom-6 h-4 w-7 rounded-b-full border-b-4 border-primary" />
    </div>
  );
}

interface LessonSpecimenProps {
  readonly showHeading?: boolean;
}

/**
 * A hint card for a task the child brought along. Hort.ai never sets its own exercises: the task
 * text is the child's, and the companion only gives step-by-step hints, never the solution and
 * never points or stars. Gallery-only: nothing is evaluated, sent or stored.
 */
export function LessonSpecimen({ showHeading = true }: LessonSpecimenProps) {
  const t = useTranslations('app');
  const [shownHints, setShownHints] = useState(1);
  const hasMoreHints = shownHints < HINT_KEYS.length;

  return (
    <section aria-labelledby="lesson-title" className="space-y-5">
      {showHeading ? (
        <div className="max-w-2xl">
          <h2 id="lesson-title" className="font-heading text-3xl text-copy">
            {t('designSystem.lesson.title')}
          </h2>
          <p className="mt-3 text-copy-muted">{t('designSystem.lesson.description')}</p>
        </div>
      ) : (
        <h2 id="lesson-title" className="sr-only">
          {t('designSystem.lesson.title')}
        </h2>
      )}

      <div
        data-world="meadow"
        className="rounded-token-xl border-2 border-border-strong bg-world p-4 shadow-lift sm:p-6"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="gap-5 p-5 lg:col-span-2">
            <div className="rounded-token-lg border-2 border-dashed border-highlight-border bg-highlight p-4">
              <p className="font-heading text-sm font-semibold text-primary-copy">
                {t('designSystem.lesson.taskLabel')}
              </p>
              <p className="mt-2 font-heading text-xl text-copy">
                {t('designSystem.lesson.taskText')}
              </p>
            </div>
            <ol aria-live="polite" className="space-y-3">
              {HINT_KEYS.slice(0, shownHints).map((key, index) => (
                <li key={key}>
                  <FeedbackPanel
                    tone="hint"
                    title={t('designSystem.lesson.hintTitle', { number: index + 1 })}
                  >
                    {t(key)}
                  </FeedbackPanel>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={!hasMoreHints}
                onClick={() => {
                  setShownHints((current) => Math.min(current + 1, HINT_KEYS.length));
                }}
              >
                {t('designSystem.lesson.nextHint')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={shownHints === 1}
                onClick={() => {
                  setShownHints(1);
                }}
              >
                {t('designSystem.lesson.reset')}
              </Button>
            </div>
            {!hasMoreHints && (
              <p className="text-base text-copy-muted">{t('designSystem.lesson.lastHint')}</p>
            )}
          </Card>

          <aside className="flex flex-col items-center justify-center gap-5 rounded-token-xl border border-highlight-border bg-highlight p-5 text-center">
            <CompanionSketch />
            <div className="max-w-xs rounded-token-xl bg-surface p-5 shadow-soft">
              <p className="font-heading text-sm font-semibold text-primary-copy">
                {t('designSystem.lesson.guideName')}
              </p>
              <p className="mt-2 text-base text-copy">{t('designSystem.lesson.guideText')}</p>
            </div>
          </aside>
        </div>
      </div>
      <p className="text-center text-sm text-copy-muted">{t('designSystem.lesson.stageLabel')}</p>
    </section>
  );
}
