'use client';

import { useTransition, useState } from 'react';

import { startHelpSessionAction } from '@modules/guidance/client';

import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

/** The MVP helps with maths only (docs/product/mvp-scope.md). */
const MVP_SUBJECT = 'math';

interface StartAssignmentHelpProps {
  readonly childProfileId: string;
  readonly assignmentId: string;
}

/**
 * Starts (or continues) help on a teacher's assignment (#33, #83). Only the id leaves the
 * browser: the server reads the task text and keeps the solution key to itself.
 */
export function StartAssignmentHelp({ childProfileId, assignmentId }: StartAssignmentHelpProps) {
  const t = useTranslations('app');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        disabled={isPending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            const result = await startHelpSessionAction({
              childProfileId,
              assignmentId,
              subject: MVP_SUBJECT,
            }).catch(() => null);
            if (result?.ok === true) {
              router.push('/help');
            } else {
              setFailed(true);
            }
          });
        }}
      >
        {isPending ? t('start.entry.sending') : t('start.school.startHelp')}
      </Button>
      {failed && (
        <p role="alert" className="text-nudge">
          {t('start.school.failed')}
        </p>
      )}
    </div>
  );
}
