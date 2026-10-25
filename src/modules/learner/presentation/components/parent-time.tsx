import { Clock } from '@components/ui/icons';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { ParentPanel } from './parent-panel';
import { formatMinute } from './time-options';

import type { ScreenTime } from '../../application/contracts/learner-constraints';
import type { ChildProfileDto } from '../dto/learner-dto';

const PERCENT = 100;

/**
 * Today's measured help minutes against the saved limit and window, in the same calculation the
 * server enforces. `screenTime.usage.usedMinutes` is `null` when the measurement could not be read:
 * then the page says so instead of showing zero or "unlimited".
 */
export function ParentTime({
  profile,
  screenTime,
}: {
  readonly profile: ChildProfileDto;
  readonly screenTime: ScreenTime;
}) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  const { usage, status, reopensAt } = screenTime;
  const used = usage.kind === 'unavailable' ? null : usage.usedMinutes;
  return (
    <div className="space-y-6">
      <ParentPanel title={t('timeTitle')} description={t('timeDescription')}>
        {used === null ? (
          <div className="flex items-start gap-4 rounded-token-lg bg-background p-5">
            <Clock aria-hidden="true" className="mt-1 size-6 shrink-0 text-primary-copy" />
            <div>
              <h3 className="font-semibold">{t('timeUnavailable')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-copy-muted">
                {t('timeUnavailableDescription')}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-token-lg bg-background p-5">
            <p className="text-sm text-copy-muted">{t('timeToday')}</p>
            <p className="mt-1 font-heading text-3xl tabular-nums">
              {t('minutesShort', { minutes: used })}
            </p>
            {usage.kind === 'limited' && (
              <>
                <div
                  role="img"
                  aria-label={t('timeOfLimit', { used, limit: usage.limitMinutes })}
                  className="mt-4 h-3 overflow-hidden rounded-full bg-sunken"
                >
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{
                      width: `${Math.min(PERCENT, (used / usage.limitMinutes) * PERCENT)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-sm">
                  {t('timeLeft', { minutes: usage.remainingMinutes, limit: usage.limitMinutes })}
                </p>
              </>
            )}
            <p className="mt-4 text-xs leading-relaxed text-copy-muted">{t('timeMeasurement')}</p>
          </div>
        )}
        <p className="mt-4 font-semibold" role="status">
          {t(`timeStatus.${status}`, {
            time:
              reopensAt === null
                ? ''
                : format.date(reopensAt, { hour: '2-digit', minute: '2-digit' }),
          })}
        </p>
        <dl className="mt-4 divide-y divide-border">
          <div className="grid gap-2 py-4 sm:grid-cols-2">
            <dt className="font-semibold">{t('dailyLimit')}</dt>
            <dd>
              {profile.dailyLimitMinutes === null
                ? t('noLimit')
                : t('minutes', { minutes: profile.dailyLimitMinutes })}
            </dd>
          </div>
          <div className="grid gap-2 py-4 sm:grid-cols-2">
            <dt className="font-semibold">{t('window')}</dt>
            <dd>
              {profile.allowedWindow === null
                ? t('anyTime')
                : t('windowValue', {
                    from: formatMinute(profile.allowedWindow.fromMinute),
                    until: formatMinute(profile.allowedWindow.untilMinute),
                  })}
            </dd>
          </div>
        </dl>
        <p className="mt-4 rounded-token-lg bg-hint-subtle p-4 text-sm leading-relaxed">
          {t('timeEnforcement')}
        </p>
        <p className="mt-4 text-sm text-copy-muted">{t('timeHistoryUnavailable')}</p>
      </ParentPanel>
    </div>
  );
}
