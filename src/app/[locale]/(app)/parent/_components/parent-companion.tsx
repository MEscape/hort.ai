import { ParentPanel } from '@modules/learner';
import type { ChildProfileDto } from '@modules/learner';
import { getProgressionQueries } from '@modules/progression';
import { FALLBACK_AREA_ID, worldIsland } from '@modules/world';
import { IslandPicture } from '@modules/world/client';

import { Character } from '@components/brand/character';

import { getTranslations } from '@i18n/server';

import { serverEnv } from '@lib/config/server';

import { orFail } from '@/app/_lib/or-fail';

import { buildTutorOptions } from '../../onboarding/tutor-options';

/** Informational only: the child's catalog, ledger and World art, with no selection controls. */
export async function ParentCompanion({ child }: { readonly child: ChildProfileDto }) {
  const t = await getTranslations('learner.dashboard');
  const companion = buildTutorOptions().find((option) => option.id === child.tutorId);
  const progress = companion
    ? await orFail(getProgressionQueries().getProgress.execute({ childProfileId: child.id }))
    : null;
  const island = worldIsland(FALLBACK_AREA_ID, serverEnv.STORAGE_PUBLIC_BASE_URL);
  return (
    <ParentPanel title={t('companionTitle')}>
      {companion && progress ? (
        <div className="flex items-center gap-4">
          <Character imageUrl={companion.imageUrl} alt="" className="size-20 shrink-0" />
          <p className="font-semibold">
            {t('companionLevel', { name: companion.name, level: progress.level })}
          </p>
        </div>
      ) : (
        <p className="text-sm text-copy-muted">{t('companionUnavailable')}</p>
      )}
      {island && (
        <div aria-hidden="true" className="mx-auto max-w-48">
          <IslandPicture
            art={island.art}
            picture={island.picture}
            sizes="192px"
            discovery={island.discovery}
          />
        </div>
      )}
      <p className="mt-3 text-sm leading-relaxed text-copy-muted">{t('worldDescription')}</p>
    </ParentPanel>
  );
}
