import { useTranslations } from '@i18n/client';

import { ParentPanel } from './parent-panel';

const DATA_GROUPS = [
  { title: 'profileData', description: 'profileDataDescription' },
  { title: 'photos', description: 'photosDescription' },
  { title: 'voicePrivacy', description: 'voicePrivacyDescription' },
] as const;
const POLICY_GROUPS = [
  { title: 'retention', description: 'retentionDescription' },
  { title: 'deletion', description: 'deletionDescription' },
  { title: 'safety', description: 'safetyDescription' },
] as const;

/** Policy gaps are explicit. No sensitive safety notes, transcript reader or pretend delete control. */
export function ParentPrivacy() {
  const t = useTranslations('learner.dashboard');
  return (
    <div className="space-y-6">
      <ParentPanel title={t('privacyTitle')} description={t('privacyDescription')}>
        <dl className="divide-y divide-border">
          {DATA_GROUPS.map((group) => (
            <div key={group.title} className="py-4 first:pt-0 last:pb-0">
              <dt className="font-semibold">{t(group.title)}</dt>
              <dd className="mt-2 max-w-prose text-sm leading-relaxed text-copy-muted">
                {t(group.description)}
              </dd>
            </div>
          ))}
        </dl>
      </ParentPanel>
      <div className="divide-y divide-border rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6">
        {POLICY_GROUPS.map((group) => (
          <section key={group.title} className="py-5 first:pt-0 last:pb-0">
            <h2 className="font-heading text-2xl">{t(group.title)}</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-copy-muted">
              {t(group.description)}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
