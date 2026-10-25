import { Suspense } from 'react';

import {
  ParentAssignments,
  ParentControlsForm,
  ParentLearning,
  ParentOverview,
  ParentPanel,
  ParentPrivacy,
  ParentTime,
  VoiceConsentSwitch,
  computeScreenTime,
  getParentLearnerServices,
} from '@modules/learner';
import type { ChildProfileDto, ParentRange, ParentSection } from '@modules/learner';

import { getTranslations } from '@i18n/server';

import { systemClock } from '@lib/clock';

import { orFail } from '@/app/_lib/or-fail';

import { ParentCompanion } from './parent-companion';

/** Route composition only: settings stay usable independently of the learning projection. */
export async function ParentContent({
  child,
  section,
  range,
}: {
  readonly child: ChildProfileDto;
  readonly section: ParentSection;
  readonly range: ParentRange;
}) {
  const t = await getTranslations('learner.dashboard');
  if (section === 'privacy') {
    return <ParentPrivacy />;
  }
  if (section === 'settings') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-3xl">{t('settingsTitle')}</h2>
          <p className="mt-2 text-copy-muted">{t('settingsDescription')}</p>
        </div>
        <VoiceConsentSwitch
          profileId={child.id}
          name={child.displayName}
          allowed={child.voiceConsent}
        />
        <p className="text-sm text-copy-muted">{t('voiceEffect')}</p>
        <ParentControlsForm key={child.id} profile={child} />
        <p className="text-sm text-copy-muted">{t('fixedChoices')}</p>
      </div>
    );
  }
  if (section === 'time') {
    return (
      <ParentTime
        profile={child}
        windowOpen={
          computeScreenTime({ controls: child, now: systemClock.now(), usedMinutes: null })
            .status !== 'closed_outside_window'
        }
      />
    );
  }
  const learning = await orFail(
    getParentLearnerServices().getLearning.execute({ profileId: child.id, range }),
  );
  if (section === 'assignments') {
    return <ParentAssignments records={learning.records} today={learning.period.today} />;
  }
  if (section === 'learning') {
    return <ParentLearning {...learning} />;
  }
  return (
    <ParentOverview
      {...learning}
      companion={
        <Suspense
          fallback={
            <ParentPanel title={t('companionTitle')}>
              <p>{t('loading')}</p>
            </ParentPanel>
          }
        >
          <ParentCompanion child={child} />
        </Suspense>
      }
    />
  );
}
