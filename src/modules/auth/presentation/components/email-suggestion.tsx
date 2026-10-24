'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

export interface EmailSuggestionProps {
  readonly id: string;
  /** The address the person probably meant, or `null`: see `suggestEmailDomain`. */
  readonly suggestion: string | null;
  readonly onAccept: (email: string) => void;
}

/** "Did you mean anna@gmail.com?" when the domain is a typo of a well-known provider; one tap puts it right. */
export function EmailSuggestion({ id, suggestion, onAccept }: EmailSuggestionProps) {
  const t = useTranslations('auth');
  if (suggestion === null) {
    return null;
  }
  return (
    <p
      id={id}
      role="status"
      className="flex flex-wrap items-center gap-x-1 text-base text-copy-muted"
    >
      {t('emailSuggestion.question')}
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto max-w-full text-left break-all whitespace-normal"
        onClick={() => {
          onAccept(suggestion);
        }}
      >
        {suggestion}
      </Button>
    </p>
  );
}
