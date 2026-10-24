'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

/** Only this small specimen needs state; the rest of the component gallery remains server-rendered. */
export function ButtonPlayground() {
  const t = useTranslations('app');
  const secondaryLabel = t('designSystem.buttons.secondary');
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
            setLastPressed(secondaryLabel);
          }}
        >
          {secondaryLabel}
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
      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-heading text-base font-semibold text-copy">
          {t('designSystem.buttons.sizes')}
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline">
            {secondaryLabel}
          </Button>
          <Button size="default" variant="outline">
            {secondaryLabel}
          </Button>
          <Button size="lg" variant="outline">
            {secondaryLabel}
          </Button>
          <Button size="icon" variant="outline" aria-label={t('designSystem.buttons.iconLabel')}>
            <span aria-hidden="true">+</span>
          </Button>
        </div>
      </div>
      <output aria-live="polite" className="mt-5 block text-sm text-copy-muted">
        {lastPressed === null
          ? t('designSystem.buttons.initial')
          : t('designSystem.buttons.selected', { name: lastPressed })}
      </output>
    </div>
  );
}
