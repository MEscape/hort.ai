'use client';

import { Button } from '@components/ui/button';
import { Camera, Info, Moon, Pencil } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';
import { useAppFormatters } from '@i18n/formatters/client';

import type { ClosedReason } from './screen-time-view';

/** The real task entry: "/start" takes the typed task and opens the help session. */
const TYPE_TASK_HREF = '/start';

interface TaskCardProps {
  readonly companionName: string;
  readonly hasVoice: boolean;
  /** Why new tasks are paused, or `null`. */
  readonly closed: ClosedReason | null;
  readonly isGuided: boolean;
  readonly onPhoto: () => void;
  readonly onVoiceInfo: () => void;
  readonly onAskAdult: () => void;
}

function ClosedNotice({
  companionName,
  closed,
  onAskAdult,
}: Pick<TaskCardProps, 'companionName' | 'closed' | 'onAskAdult'> & {
  readonly closed: ClosedReason;
}) {
  const t = useTranslations('app');
  const formatters = useAppFormatters();
  const time =
    closed.reopensAt === null
      ? null
      : formatters.date(closed.reopensAt, { hour: 'numeric', minute: '2-digit' });
  return (
    <div
      id="task-closed"
      className="flex flex-col gap-3 rounded-token-lg border-2 border-hint-border bg-hint-subtle p-4 text-hint"
    >
      <p className="flex items-start gap-3 text-lead font-semibold">
        <Moon aria-hidden="true" className="mt-1 size-6 shrink-0" />
        {closed.reason === 'window' && time !== null
          ? t('home.closed.window', { name: companionName, time })
          : t('home.closed.limit', { name: companionName })}
      </p>
      <p className="text-base">{t('home.closed.still', { name: companionName })}</p>
      <Button type="button" variant="outline" onClick={onAskAdult} className="self-start text-copy">
        {t('home.closed.ask')}
      </Button>
    </div>
  );
}

/**
 * "I have a task": the primary card. A big camera button and a smaller way to type or say it. While
 * the day is closed both are paused with a friendly note and a way to ask a grown-up; with voice
 * off a quiet chip says why the companion will not listen, which is information, not an error.
 */
export function TaskCard({
  companionName,
  hasVoice,
  closed,
  isGuided,
  onPhoto,
  onVoiceInfo,
  onAskAdult,
}: TaskCardProps) {
  const t = useTranslations('app');
  const isClosed = closed !== null;
  return (
    <section
      data-guide-target="task"
      data-guided={isGuided}
      aria-labelledby="task-title"
      className="flex min-w-0 flex-col gap-3 rounded-token-xl bg-surface p-5 shadow-lift data-[guided=true]:ring-4 data-[guided=true]:ring-accent md:gap-4 md:p-6"
    >
      <h2
        id="task-title"
        className="font-heading text-2xl leading-tight font-semibold text-copy md:text-3xl"
      >
        {t('home.task.title')}
      </h2>
      {isClosed && (
        <ClosedNotice companionName={companionName} closed={closed} onAskAdult={onAskAdult} />
      )}
      <Button
        asChild
        size="lg"
        className="min-h-16 w-full gap-3 text-lg whitespace-normal md:text-xl"
        aria-disabled={isClosed}
      >
        <Link
          href={TYPE_TASK_HREF}
          aria-describedby={isClosed ? 'task-closed' : undefined}
          tabIndex={isClosed ? -1 : undefined}
          className={isClosed ? 'pointer-events-none opacity-60' : undefined}
        >
          <Pencil aria-hidden="true" className="size-6" />
          {t('home.task.type')}
        </Link>
      </Button>
      <div>
        <Button
          type="button"
          size="lg"
          variant="ghost"
          disabled={isClosed}
          aria-describedby={isClosed ? 'task-closed' : undefined}
          onClick={onPhoto}
          className="min-h-12 w-full gap-3 text-base whitespace-normal"
        >
          <Camera aria-hidden="true" className="size-8" />
          {t('home.task.photo')}
        </Button>
      </div>
      {!hasVoice && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onVoiceInfo}
          className="self-start"
        >
          <Info aria-hidden="true" />
          {t('home.task.typingOnly')}
        </Button>
      )}
    </section>
  );
}
