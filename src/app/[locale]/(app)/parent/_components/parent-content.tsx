import { Suspense } from 'react';

import { ChildClassroomPanel, classroomQueries } from '@modules/classroom';
import { getHelpSessionQueries } from '@modules/guidance';
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
import { logger } from '@lib/logger';

import { orFail } from '@/app/_lib/or-fail';

import { describeTopics } from './describe-topics';
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
    // The count the daily limit is enforced against. A failed read shows "not available", never zero.
    const minutes = await getHelpSessionQueries().getTodayHelpMinutes.execute({
      childProfileId: child.id,
    });
    if (minutes.isErr()) {
      logger.warn('parent.help_minutes_unavailable', { code: minutes.error.code });
    }
    const usedMinutes = minutes.isOk() ? minutes.value : null;
    return (
      <ParentTime
        profile={child}
        screenTime={computeScreenTime({ controls: child, now: systemClock.now(), usedMinutes })}
      />
    );
  }
  const learning = await orFail(
    getParentLearnerServices().getLearning.execute({ profileId: child.id, range }),
  );
  if (section === 'assignments') {
    const classroom = await orFail(classroomQueries.getChildClassroom.execute(child.id));
    return (
      <div className="space-y-6">
        <div className="rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6">
          <ChildClassroomPanel
            childProfileId={child.id}
            childName={child.displayName}
            classroom={classroom && { name: classroom.name, grade: classroom.grade }}
          />
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-copy-muted">
            {t('classDescription')}
          </p>
        </div>
        <ParentAssignments records={learning.records} today={learning.period.today} />
      </div>
    );
  }
  if (section === 'learning') {
    const topics = await describeTopics(learning.records.tasks.map((task) => task.competencyCode));
    return <ParentLearning {...learning} topics={topics} />;
  }
  return (
    <ParentOverview
      {...learning}
      companion={
        <Suspense
          fallback={
            <ParentPanel title={t('companionTitle')}>
              <p role="status">{t('loading')}</p>
            </ParentPanel>
          }
        >
          <ParentCompanion child={child} />
        </Suspense>
      }
    />
  );
}
