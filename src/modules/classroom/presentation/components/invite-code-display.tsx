'use client';

import { Button } from '@components/ui/button';
import { Check, Copy } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useCopyText } from '../hooks/use-copy-text';

interface InviteCodeDisplayProps {
  /** `ABCD-EFGH`. */
  readonly code: string;
}

/** The code in large, spaced type (no ambiguous symbols exist in it) with a copy button. */
export function InviteCodeDisplay({ code }: InviteCodeDisplayProps) {
  const t = useTranslations('classroom');
  const clipboard = useCopyText(code);

  return (
    <div className="flex flex-col items-start gap-3 rounded-token-lg bg-sunken p-4">
      <p className="text-sm font-semibold text-copy-muted">{t('code.label')}</p>
      <p className="font-heading text-4xl tracking-widest break-all text-copy sm:text-5xl">
        {code}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={clipboard.copy}>
          {clipboard.state === 'copied' ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {t('code.copy')}
        </Button>
        <p role="status" className="text-sm text-copy-muted">
          {clipboard.state === 'copied' && t('code.copied')}
          {clipboard.state === 'failed' && t('code.copyFailed')}
        </p>
      </div>
    </div>
  );
}
