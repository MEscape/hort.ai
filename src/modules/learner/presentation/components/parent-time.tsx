import { Clock } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { ParentPanel } from './parent-panel';
import { formatMinute } from './time-options';

import type { ChildProfileDto } from '../dto/learner-dto';

/** Saved preferences and calculated window state are distinct from unavailable usage or enforcement. */
export function ParentTime({
  profile,
  windowOpen,
}: {
  readonly profile: ChildProfileDto;
  readonly windowOpen: boolean;
}) {
  const t = useTranslations('learner.dashboard');
  return (
    <div className="space-y-6">
      <ParentPanel title={t('timeTitle')} description={t('timeDescription')}>
        <div className="flex items-start gap-4 rounded-token-lg bg-background p-5">
          <Clock aria-hidden="true" className="mt-1 size-6 shrink-0 text-primary-copy" />
          <div>
            <h3 className="font-semibold">{t('timeUnavailable')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-copy-muted">
              {t('timeUnavailableDescription')}
            </p>
          </div>
        </div>
        <dl className="mt-6 divide-y divide-border">
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
      </ParentPanel>
      {profile.allowedWindow !== null && (
        <ParentPanel title={windowOpen ? t('windowOpen') : t('windowClosed')}>
          <p className="text-sm text-copy-muted">{t('windowCaution')}</p>
        </ParentPanel>
      )}
    </div>
  );
}
