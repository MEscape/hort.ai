'use client';

import { useState } from 'react';

import { FeedbackPanel } from '@components/shared/feedback-panel';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

const APPLE_COUNT = 3;
const APPLE_IDS = Array.from({ length: APPLE_COUNT }, (_, index) => index + 1);

/** A deliberately simple, original vector placeholder: not final character or lesson artwork. */
function AppleIllustration({ isSmall = false }: { readonly isSmall?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 72"
      className={isSmall ? 'h-10 w-10' : 'h-11 w-11'}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M34 20C34 10 38 8 40 7"
        fill="none"
        stroke="currentColor"
        className="text-primary-copy"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M36 17C42 5 56 6 57 7C55 20 43 25 36 17Z" className="fill-secondary" />
      <path
        d="M32 26C16 15 5 28 8 45C11 63 24 67 32 62C41 67 55 63 57 44C59 28 47 16 32 26Z"
        className="fill-bloom stroke-primary-copy"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M18 35C15 39 14 43 15 47"
        fill="none"
        className="stroke-bloom-foreground"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

/** Tap-to-move is a gallery-only interaction; it does not evaluate or persist learning answers. */
export function LessonSpecimen() {
  const t = useTranslations('app');
  const [selectedApples, setSelectedApples] = useState<readonly number[]>([]);
  const isComplete = selectedApples.length === APPLE_COUNT;
  const handlePick = (id: number) => {
    setSelectedApples((current) => (current.includes(id) ? current : [...current, id]));
  };
  const handleReset = () => {
    setSelectedApples([]);
  };

  return (
    <section aria-labelledby="lesson-title" className="space-y-5">
      <div className="max-w-2xl">
        <h2 id="lesson-title" className="font-heading text-3xl text-copy">
          {t('designSystem.lesson.title')}
        </h2>
        <p className="mt-3 text-copy-muted">{t('designSystem.lesson.description')}</p>
      </div>

      <div
        data-world="meadow"
        className="rounded-token-xl border-2 border-border-strong bg-world p-4 shadow-lift sm:p-6 xl:aspect-16/10"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="font-heading text-xl font-semibold text-primary-copy">
            {t('designSystem.lesson.taskTitle')}
          </p>
          <span className="rounded-token-lg bg-surface px-4 py-2 font-heading text-sm font-semibold text-copy shadow-soft">
            {t('designSystem.lesson.progress')}
          </span>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Card className="space-y-5 lg:col-span-2">
            <h3 className="font-heading text-xl text-copy">{t('designSystem.lesson.prompt')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="min-w-0 rounded-token-lg border-2 border-dashed border-highlight-border bg-highlight p-3">
                <legend className="px-2 font-heading text-sm font-semibold text-primary-copy">
                  {t('designSystem.lesson.tray')}
                </legend>
                <div className="flex min-h-32 flex-wrap items-center justify-center gap-2">
                  {APPLE_IDS.map((id) => (
                    <Button
                      key={id}
                      size="icon"
                      variant="outline"
                      disabled={selectedApples.includes(id)}
                      aria-label={t('designSystem.lesson.selectApple', { number: id })}
                      onClick={() => {
                        handlePick(id);
                      }}
                      className="rounded-token-lg disabled:opacity-25"
                    >
                      <AppleIllustration />
                    </Button>
                  ))}
                </div>
              </fieldset>
              <div className="min-w-0 space-y-3">
                <p className="font-heading text-sm font-semibold text-primary-copy">
                  {t('designSystem.lesson.basket')}
                </p>
                <div
                  aria-hidden="true"
                  className="flex min-h-32 flex-wrap items-center justify-center gap-1 rounded-b-token-xl rounded-t-token-sm border-4 border-secondary-copy bg-secondary p-3 shadow-soft"
                >
                  {selectedApples.map((id) => (
                    <AppleIllustration key={id} isSmall />
                  ))}
                </div>
                <output
                  aria-live="polite"
                  className="block text-center font-heading font-semibold text-copy"
                >
                  {t('designSystem.lesson.count', { count: selectedApples.length })}
                </output>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedApples.length === 0}
              onClick={handleReset}
            >
              {t('designSystem.lesson.reset')}
            </Button>
            {isComplete && (
              <FeedbackPanel announce tone="success" title={t('designSystem.lesson.completeTitle')}>
                {t('designSystem.lesson.completeBody')}
              </FeedbackPanel>
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
