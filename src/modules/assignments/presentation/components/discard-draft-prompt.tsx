import { useEffect, useRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { TriangleAlert } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

interface DiscardDraftPromptProps {
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
}

/** Inline confirmation preserves the draft until explicit discard and restores the invoking control's focus. */
export function DiscardDraftPrompt({ onKeep, onDiscard }: DiscardDraftPromptProps) {
  const t = useTranslations('assignments');
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      returnFocus.current?.focus();
    };
  }, []);
  const keepRef = useFocusOnMount<HTMLButtonElement>(true);

  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{t('discard.title')}</AlertTitle>
      <AlertDescription>
        <p>{t('discard.body')}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button ref={keepRef} type="button" variant="outline" onClick={onKeep}>
            {t('discard.keep')}
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            {t('discard.confirm')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
