'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@components/ui/dialog';

import { useRouter } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { InviteCodeSection } from './invite-code-section';

import type { ClassroomDetailsView } from '../../application/contracts/classroom-views';

interface ClassroomDetailsDialogProps {
  /** Loaded on the server for the signed-in teacher; children by display name only. */
  readonly details: ClassroomDetailsView;
  /** Where closing leads: the same page without the details parameter. */
  readonly closeHref: string;
}

/**
 * A class's details, opened from its info button. It is a page state (`?details=`), so it loads on
 * the server after the ownership check; closing replaces the address without the parameter, which
 * leaves the selected class and any draft in the editor untouched.
 */
export function ClassroomDetailsDialog({ details, closeHref }: ClassroomDetailsDialogProps) {
  const t = useTranslations('classroom');
  const router = useRouter();
  const format = useAppFormatters();
  const { classroom, members } = details;

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          router.replace(closeHref, { scroll: false });
        }
      }}
    >
      <DialogContent closeLabel={t('dialog.close')}>
        <DialogTitle>{classroom.name}</DialogTitle>
        <DialogDescription>{t('created.grade', { grade: classroom.grade })}</DialogDescription>
        <InviteCodeSection
          classroomId={classroom.id}
          inviteCode={details.inviteCode}
          expiresAt={details.inviteCodeExpiresAt}
          isExpired={details.isInviteCodeExpired}
        />
        <section className="flex flex-col gap-2">
          <h3 className="font-heading text-xl text-copy">
            {t('details.membersTitle', { count: members.length })}
          </h3>
          {members.length === 0 ? (
            <p className="text-copy-muted">{t('details.membersEmpty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => (
                <li key={member.memberId} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 break-words text-copy">{member.displayName}</span>
                  <span className="shrink-0 text-sm text-copy-muted">
                    {t('details.joined', {
                      date: format.date(member.joinedAt.getTime(), { dateStyle: 'medium' }),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
