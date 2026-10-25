'use client';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { WELCOME_STAGES } from './use-welcome-flow';

/**
 * Where the child is on the way: one dot per step. The step they are on is a long pill (shape, not
 * colour), the ones behind are filled, the ones ahead are rings. A screen reader gets the step
 * number and a list of the step names with the current one marked.
 */
export function WelcomeProgress({ index }: { readonly index: number }) {
  const t = useTranslations('learner');
  const total = WELCOME_STAGES.length;
  return (
    <nav aria-label={t('childWelcome.progress.label')}>
      <p className="sr-only">{t('childWelcome.progress.step', { current: index + 1, total })}</p>
      <ol
        aria-label={t('childWelcome.progress.label')}
        className="flex items-center justify-center gap-2.5"
      >
        {WELCOME_STAGES.map((stage, position) => (
          <li
            key={stage}
            aria-current={position === index ? 'step' : undefined}
            className={cn(
              'h-3.5 rounded-full border-2 border-primary-copy transition-[width,background-color] duration-300 ease-spring',
              position < index && 'w-3.5 bg-primary-copy',
              position === index && 'w-10 bg-accent',
              position > index && 'w-3.5 bg-surface',
            )}
          >
            <span className="sr-only">{t(`childWelcome.steps.${stage}`)}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
