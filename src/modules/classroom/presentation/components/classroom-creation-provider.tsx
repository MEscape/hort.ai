'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@components/ui/dialog';

import { useTranslations } from '@i18n/client';

import { ClassroomCreatedContext } from '../hooks/use-announce-classroom-created';

import { InviteCodeDisplay } from './invite-code-display';

import type { CreatedClassroom } from '../hooks/use-announce-classroom-created';

/**
 * Owns the "class created" dialog for everything below it. Rendered by the page above the parts
 * that re-render or remount once the class exists (a refresh, the switch from the first-class panel
 * to the overview), so the dialog stays until the teacher closes it, and only then.
 */
export function ClassroomCreationProvider({ children }: { readonly children: ReactNode }) {
  const t = useTranslations('classroom');
  const [created, setCreated] = useState<CreatedClassroom | null>(null);

  return (
    <ClassroomCreatedContext value={setCreated}>
      {children}
      <Dialog
        open={created !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreated(null);
          }
        }}
      >
        {created !== null && (
          <DialogContent
            closeLabel={t('dialog.close')}
            // A stray tap next to the dialog must not take the only display of the code away.
            onInteractOutside={(event) => {
              event.preventDefault();
            }}
          >
            <DialogTitle>{t('created.title', { name: created.name })}</DialogTitle>
            <DialogDescription>{t('created.grade', { grade: created.grade })}</DialogDescription>
            <InviteCodeDisplay code={created.inviteCode} />
            <p className="text-copy">{t('created.share')}</p>
            <Button
              type="button"
              className="self-end"
              onClick={() => {
                setCreated(null);
              }}
            >
              {t('created.done')}
            </Button>
          </DialogContent>
        )}
      </Dialog>
    </ClassroomCreatedContext>
  );
}
