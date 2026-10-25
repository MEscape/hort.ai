'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog';
import { Plus } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { CreateClassroomForm } from './create-classroom-form';

/**
 * "+ Add class" next to the class selector. Opening it changes no class and touches no draft in
 * the editor beside it; after creating, it closes and the code dialog takes over.
 */
export function AddClassroomDialog() {
  const t = useTranslations('classroom');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus aria-hidden="true" />
          {t('add.open')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('dialog.close')}>
        <DialogTitle>{t('add.title')}</DialogTitle>
        <DialogDescription>{t('add.description')}</DialogDescription>
        <CreateClassroomForm
          onCreated={() => {
            setIsOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
