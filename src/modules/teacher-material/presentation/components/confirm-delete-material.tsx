'use client';

import { useEffect } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { TriangleAlert } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

interface ConfirmDeleteMaterialProps {
  readonly title: string;
  readonly onKeep: () => void;
  readonly onConfirm: () => void;
}

/**
 * Asks once before a material is deleted. The safe choice gets focus first; closing restores focus
 * to the control that opened it. shortcut: mirrors the assignments module's `ConfirmPrompt`, which
 * is not public; replace both with one shared component once `src/components` offers it.
 */
export function ConfirmDeleteMaterial({ title, onKeep, onConfirm }: ConfirmDeleteMaterialProps) {
  const t = useTranslations('teacherMaterial.section.confirmDelete');
  // Runs before the focus move below, so it still sees the opener.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      opener?.focus();
    };
  }, []);
  const keepRef = useFocusOnMount<HTMLButtonElement>(true);

  return (
    <Alert variant="warning" className="w-full">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t('title', { title })}</AlertTitle>
      <AlertDescription>
        <p>{t('body')}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button ref={keepRef} type="button" variant="outline" onClick={onKeep}>
            {t('keep')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm}>
            {t('confirm')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
