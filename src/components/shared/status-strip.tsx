'use client';

import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';
import { Clock, Lock, Mic, Moon, Pause, Pencil, WifiOff } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';
import { useAppFormatters } from '@i18n/formatters/client';

import { cn } from '@lib/utils';

import { StatusRing } from './status-ring';

/** What the strip says about the day's time. Built from the server's state; the strip decides nothing. */
export type StripTime =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'left';
      readonly minutes: number;
      /** Share of the limit that is left, or `null` when only a time window ends (no ring then). */
      readonly fraction: number | null;
      readonly isLow: boolean;
    }
  | { readonly kind: 'learned'; readonly minutes: number }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'closed';
      readonly reason: 'limit' | 'window';
      readonly reopensAt: Date | null;
    };

export interface StripSession {
  readonly task: string;
  readonly state: 'listening' | 'typing' | 'paused';
  /** Where "go back" leads. */
  readonly href: string;
}

export interface StatusStripProps {
  readonly time: StripTime;
  /** The running session, or `null`: then nothing is shown for it. */
  readonly session: StripSession | null;
  readonly isOffline?: boolean;
  /** Opens the parental gate. */
  readonly onParentArea: () => void;
  /** Called when the child taps the time: the page can explain it. */
  readonly onTimeTap?: () => void;
  readonly className?: string;
}

const SESSION_ICON = { listening: Mic, typing: Pencil, paused: Pause } as const;

function TimeText({ time }: { readonly time: StripTime }) {
  const t = useTranslations('app');
  const formatters = useAppFormatters();
  switch (time.kind) {
    case 'hidden':
      return null;
    case 'left':
      return t(time.isLow ? 'home.status.low' : 'home.status.left', { minutes: time.minutes });
    case 'learned':
      return t('home.status.learned', { minutes: time.minutes });
    case 'unavailable':
      return t('home.status.unavailable');
    case 'closed':
      return time.reason === 'limit' || time.reopensAt === null
        ? t('home.status.closedLimit')
        : t('home.status.closedWindow', {
            time: formatters.date(time.reopensAt, { hour: 'numeric', minute: '2-digit' }),
          });
  }
}

function TimeIcon({ time }: { readonly time: StripTime }) {
  if (time.kind === 'left' && time.fraction !== null) {
    return <StatusRing fraction={time.fraction} isLow={time.isLow} />;
  }
  const Icon = time.kind === 'closed' ? Moon : Clock;
  return <Icon aria-hidden="true" className="size-6 shrink-0 text-primary-copy" />;
}

function SessionChip({ session }: { readonly session: StripSession }) {
  const t = useTranslations('app');
  const Icon = SESSION_ICON[session.state];
  const state = t(`home.session.state.${session.state}`);
  return (
    <Button asChild variant="secondary" className="h-12 min-w-0 max-w-full justify-start">
      <Link href={session.href} aria-label={t('home.session.back', { task: session.task })}>
        <Icon aria-hidden="true" />
        <span className="truncate">{t('home.session.chip', { task: session.task, state })}</span>
      </Link>
    </Button>
  );
}

function Slot({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={cn('flex min-w-0 items-center', className)}>{children}</div>;
}

/**
 * The slim strip every child screen can show: today's time as a ring and a few words, the running
 * session if there is one, and the lock that leads to the grown-ups. It is not navigation. The
 * time never turns red and never counts down in front of the child: it says how much is left, or
 * that Lili is resting. A tap on the time or the lock only calls what the page wires to it.
 */
export function StatusStrip({
  time,
  session,
  isOffline = false,
  onParentArea,
  onTimeTap,
  className,
}: StatusStripProps) {
  const t = useTranslations('app');
  const hasTime = time.kind !== 'hidden';
  const hasContent = hasTime || session !== null || isOffline;
  return (
    <section
      aria-label={t('home.status.label')}
      className={cn(
        'flex min-h-14 items-center gap-3 rounded-token-xl px-3 py-1',
        hasContent && 'border border-border bg-surface/90 shadow-soft',
        className,
      )}
    >
      <Slot className="flex-1 gap-2">
        {hasTime && (
          <Button
            type="button"
            variant="ghost"
            onClick={onTimeTap}
            className="h-12 min-w-0 justify-start gap-2 px-2 text-left whitespace-normal text-copy"
          >
            <TimeIcon time={time} />
            <span
              role="status"
              className={cn(
                'text-base leading-tight',
                time.kind === 'left' && time.isLow && 'text-hint',
              )}
            >
              <TimeText time={time} />
            </span>
          </Button>
        )}
        {session !== null && <SessionChip session={session} />}
      </Slot>
      {isOffline && (
        <p role="status" className="flex items-center gap-1 text-sm text-copy-muted">
          <WifiOff aria-hidden="true" className="size-5 shrink-0" />
          {t('home.status.offline')}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onParentArea}
        aria-label={t('home.status.parentArea')}
      >
        <Lock aria-hidden="true" />
      </Button>
    </section>
  );
}
