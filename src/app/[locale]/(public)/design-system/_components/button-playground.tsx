'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

/** Only this small specimen needs state; the rest of the component gallery remains server-rendered. */
export function ButtonPlayground() {
  const t = useTranslations('app');
  const [lastPressed, setLastPressed] = useState<string | null>(null);

  return (
    <div className="rounded-token-xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setLastPressed(t('designSystem.buttons.primary'));
          }}
        >
          {t('designSystem.buttons.primary')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setLastPressed(t('designSystem.buttons.secondary'));
          }}
        >
          {t('designSystem.buttons.secondary')}
        </Button>
        <Button
          variant="accent"
          onClick={() => {
            setLastPressed(t('designSystem.buttons.accent'));
          }}
        >
          {t('designSystem.buttons.accent')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setLastPressed(t('designSystem.buttons.outline'));
          }}
        >
          {t('designSystem.buttons.outline')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setLastPressed(t('designSystem.buttons.ghost'));
          }}
        >
          {t('designSystem.buttons.ghost')}
        </Button>
        <Button disabled>{t('designSystem.buttons.disabled')}</Button>
      </div>
      <output aria-live="polite" className="mt-5 block text-sm text-copy-muted">
        {lastPressed === null
          ? t('designSystem.buttons.initial')
          : t('designSystem.buttons.selected', { name: lastPressed })}
      </output>
    </div>
  );
}
