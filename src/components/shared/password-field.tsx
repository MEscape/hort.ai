'use client';

import type { ComponentProps } from 'react';

import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { Eye, EyeOff, TriangleAlert } from '@components/ui/icons';

import { usePasswordField } from '@hooks/use-password-field';

import { useTranslations } from '@i18n/client';

export type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>;

/**
 * A password field with a show/hide button (a toggle: its name stays "Show password" and
 * `aria-pressed` says whether it is on) and a quiet warning when Caps Lock is on. The warning is
 * words plus an icon, and is read out when it appears.
 */
export function PasswordField({
  children,
  guidanceId,
  onKeyUp,
  onKeyDown,
  ...props
}: PasswordFieldProps) {
  const t = useTranslations('app');
  const { isVisible, toggleVisibility, isCapsLockOn, trackCapsLock } = usePasswordField();
  const capsId = `${props.id}-caps`;

  return (
    <TextField
      {...props}
      type={isVisible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      guidanceId={[isCapsLockOn ? capsId : null, guidanceId].filter(Boolean).join(' ') || undefined}
      onKeyUp={(event) => {
        trackCapsLock(event);
        onKeyUp?.(event);
      }}
      onKeyDown={(event) => {
        trackCapsLock(event);
        onKeyDown?.(event);
      }}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-pressed={isVisible}
          aria-label={t('password.toggle')}
          onClick={toggleVisibility}
        >
          {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      }
    >
      {isCapsLockOn && (
        <p
          id={capsId}
          role="status"
          className="flex items-center gap-2 text-base leading-snug text-warning"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t('password.capsLock')}
        </p>
      )}
      {children}
    </TextField>
  );
}
