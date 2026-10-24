'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface PasswordFieldState {
  /** Whether the password is shown as text. */
  readonly isVisible: boolean;
  readonly toggleVisibility: () => void;
  /** Whether Caps Lock was on at the last key press: the usual reason a right password is refused. */
  readonly isCapsLockOn: boolean;
  /** Pass to the input's `onKeyUp` and `onKeyDown`. */
  readonly trackCapsLock: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/** The two bits of local state a password field needs: show/hide, and the Caps Lock warning. */
export function usePasswordField(): PasswordFieldState {
  const [isVisible, setIsVisible] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  return {
    isVisible,
    toggleVisibility: () => {
      setIsVisible((current) => !current);
    },
    isCapsLockOn,
    trackCapsLock: (event) => {
      setIsCapsLockOn(event.getModifierState('CapsLock'));
    },
  };
}
