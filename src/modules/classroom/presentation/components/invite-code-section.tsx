'use client';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { RotateCcw, TriangleAlert } from '@components/ui/icons';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { useRegenerateInviteCode } from '../hooks/use-regenerate-invite-code';
import { messageKeyForCode } from '../messages/message-keys';

import { InviteCodeDisplay } from './invite-code-display';

interface InviteCodeSectionProps {
  readonly classroomId: string;
  /** The current code, or `null` when only its hash is stored. */
  readonly inviteCode: string | null;
  readonly expiresAt: Date;
  readonly isExpired: boolean;
}

/**
 * The class's code at the top of its details: shown when it can be, "unavailable" when only its
 * hash exists, with its expiry, and an explicit, confirmed way to replace it. Opening the dialog
 * never replaces anything.
 */
export function InviteCodeSection({
  classroomId,
  inviteCode,
  expiresAt,
  isExpired,
}: InviteCodeSectionProps) {
  const t = useTranslations('classroom');
  const format = useAppFormatters();
  const regenerate = useRegenerateInviteCode(classroomId);
  const code = regenerate.newCode ?? inviteCode;

  return (
    <section aria-label={t('code.label')} className="flex flex-col gap-3">
      {code === null ? (
        <div className="rounded-token-lg bg-sunken p-4">
          <p className="font-semibold text-copy">{t('details.codeUnavailable')}</p>
          <p className="text-sm text-copy-muted">{t('details.codeUnavailableHint')}</p>
        </div>
      ) : (
        <InviteCodeDisplay code={code} />
      )}
      {regenerate.newCode === null && (
        <p className="text-sm text-copy-muted">
          {isExpired
            ? t('details.codeExpired')
            : t('details.codeValidUntil', {
                date: format.date(expiresAt.getTime(), { dateStyle: 'long' }),
              })}
        </p>
      )}
      {regenerate.isConfirming ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t('details.regenerateTitle')}</AlertTitle>
          <AlertDescription>
            <p>{t('details.regenerateBody')}</p>
            {regenerate.errorCode !== null && (
              <p role="alert" className="mt-2 font-semibold">
                {t(messageKeyForCode(regenerate.errorCode))}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={regenerate.isPending}
                onClick={regenerate.cancel}
              >
                {t('details.regenerateKeep')}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={regenerate.isPending}
                onClick={regenerate.confirm}
              >
                {regenerate.isPending ? t('details.regenerating') : t('details.regenerateConfirm')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={regenerate.request}
        >
          <RotateCcw aria-hidden="true" />
          {t('details.regenerate')}
        </Button>
      )}
    </section>
  );
}
