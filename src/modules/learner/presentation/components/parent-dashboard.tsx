import type { ReactNode } from 'react';

import { BookOpen, Clock, Lock, School, ShieldCheck, Users, Volume2 } from '@components/ui/icons';

import { Link } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { learnerRoutes } from '../routes';

import type { ParentRange, ParentSection } from '../../application/contracts/parent-learning-views';

const NAVIGATION = [
  { section: 'overview', icon: Users },
  { section: 'learning', icon: BookOpen },
  { section: 'assignments', icon: School },
  { section: 'time', icon: Clock },
  { section: 'settings', icon: Volume2 },
  { section: 'privacy', icon: ShieldCheck },
] as const;
const RANGES = ['today', 'week', 'month'] as const;

/** Adult navigation is scoped to this page; the child Home has no dashboard contents or logout. */
export function ParentDashboard({
  name,
  section,
  range,
  updatedAt,
  actions,
  children,
}: {
  readonly name: string;
  readonly section: ParentSection;
  readonly range: ParentRange;
  readonly updatedAt: string;
  readonly actions: ReactNode;
  readonly children: ReactNode;
}) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 text-copy sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8 flex flex-col justify-between gap-6 border-b border-border pb-6 lg:flex-row lg:items-start">
        <div className="min-w-0 max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary-copy">
            <Lock aria-hidden="true" className="size-4" />
            {t('eyebrow')}
          </p>
          <h1 className="font-heading text-3xl font-medium leading-tight sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-3 break-words text-copy-muted">{t('intro', { name })}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">{actions}</div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-6">
          <nav
            aria-label={t('navLabel')}
            className="grid grid-cols-2 gap-2 rounded-token-xl bg-sunken/50 p-2 sm:grid-cols-3 lg:grid-cols-1"
          >
            {NAVIGATION.map(({ section: target, icon: Icon }) => (
              <Link
                key={target}
                href={learnerRoutes.parent(target, range)}
                prefetch={false}
                aria-current={target === section ? 'page' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-token px-3 py-3 text-sm font-semibold transition-colors ${target === section ? 'bg-primary text-primary-foreground shadow-soft' : 'text-copy-muted hover:bg-highlight hover:text-copy'}`}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{t(`nav.${target}`)}</span>
              </Link>
            ))}
          </nav>
          <p className="mt-4 hidden px-3 text-xs leading-relaxed text-copy-muted lg:block">
            {t('restricted')}
          </p>
        </aside>
        <div className="min-w-0 space-y-6 lg:col-span-4">
          <div className="flex flex-col gap-3">
            {(section === 'overview' || section === 'learning') && (
              <nav aria-label={t('rangeLabel')} className="flex flex-wrap gap-2">
                {RANGES.map((target) => (
                  <Link
                    key={target}
                    href={learnerRoutes.parent(section, target)}
                    prefetch={false}
                    aria-current={target === range ? 'true' : undefined}
                    className={`flex min-h-11 items-center rounded-token border px-4 py-2 text-sm font-semibold ${target === range ? 'border-border-strong bg-highlight text-copy' : 'border-border bg-surface text-copy-muted hover:bg-highlight'}`}
                  >
                    {t(`ranges.${target}`)}
                  </Link>
                ))}
              </nav>
            )}
            <p className="text-sm text-copy-muted">
              {t('updated', { date: format.dateTime(updatedAt) })}
            </p>
          </div>
          {children}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-copy-muted">
            <p className="max-w-prose">{t('freshness')}</p>
            <Link
              href={learnerRoutes.parent(section, range)}
              prefetch={false}
              className="flex min-h-11 items-center font-semibold text-primary-copy underline underline-offset-4"
            >
              {t('refresh')}
            </Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
