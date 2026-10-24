import type { Ref } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { StartIllustration } from './start-illustration';

interface StartChoicesProps {
  readonly onSelect: (view: 'task' | 'school' | 'continue') => void;
  readonly primaryActionRef: Ref<HTMLButtonElement>;
}

const SECONDARY_ACTION_CLASSES =
  'min-h-40 w-full justify-start gap-4 rounded-token-xl border-b-8 px-5 py-5 text-xl text-copy shadow-soft hover:shadow-lift active:translate-y-1 motion-reduce:transform-none sm:text-2xl md:col-span-2 md:min-h-72 md:flex-col md:justify-center md:gap-6 md:px-4';
const WAVE = '👋';
const FORWARD_ARROW = '→';

export function StartChoices({ onSelect, primaryActionRef }: StartChoicesProps) {
  const t = useTranslations('app');

  return (
    <div className="pb-safe">
      <div className="mx-auto my-6 flex max-w-3xl items-center justify-center gap-3 sm:gap-7">
        <StartIllustration kind="companion" className="h-32 w-32 shrink-0 sm:h-40 sm:w-40" />
        <div className="space-y-2">
          <p className="font-heading text-xl text-primary-copy sm:text-3xl">
            {t('start.greeting')} <span aria-hidden="true">{WAVE}</span>
          </p>
          <h1 className="font-heading text-3xl font-semibold text-copy sm:text-5xl">
            {t('start.question')}
          </h1>
        </div>
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-7 md:gap-5">
        <Button
          ref={primaryActionRef}
          size="lg"
          onClick={() => {
            onSelect('task');
          }}
          className="min-h-48 w-full flex-col justify-start gap-4 rounded-token-xl border-b-8 border-focus px-5 py-6 text-2xl shadow-lift active:translate-y-1 motion-reduce:transform-none sm:flex-row sm:text-3xl md:col-span-3 md:min-h-80 md:flex-col md:justify-center md:gap-5"
        >
          <StartIllustration kind="task" className="h-32 w-32 shrink-0 md:h-44 md:w-52" />
          <span className="flex items-center gap-3">
            {t('start.actions.task')} <span aria-hidden="true">{FORWARD_ARROW}</span>
          </span>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onSelect('school');
          }}
          className={SECONDARY_ACTION_CLASSES}
        >
          <StartIllustration
            kind="school"
            className="h-20 w-20 shrink-0 sm:h-28 sm:w-28 md:h-40 md:w-44"
          />
          <span>{t('start.actions.school')}</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onSelect('continue');
          }}
          className={SECONDARY_ACTION_CLASSES}
        >
          <StartIllustration
            kind="continue"
            className="h-20 w-20 shrink-0 sm:h-28 sm:w-28 md:h-40 md:w-44"
          />
          <span>{t('start.actions.continue')}</span>
        </Button>
      </div>
    </div>
  );
}
