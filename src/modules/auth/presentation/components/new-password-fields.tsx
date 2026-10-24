'use client';

import { PasswordField } from '@components/shared/password-field';

import { PasswordGuidance } from './password-guidance';
import { PasswordMatch } from './password-match';

import type { PasswordAssessment } from '../password/password-strength';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface NewPasswordFieldsProps {
  readonly id: string;
  readonly passwordLabel: string;
  readonly confirmLabel: string;
  /** From the form's `register` of the new password and of its repeat. */
  readonly passwordRegistration: UseFormRegisterReturn;
  readonly confirmRegistration: UseFormRegisterReturn;
  readonly password: string;
  readonly confirmation: string;
  readonly assessment: PasswordAssessment;
  readonly passwordError: string | undefined;
  readonly confirmError: string | undefined;
}

/**
 * Choosing a password: the field with its strength and rules beneath it, and the repeat with a
 * tick when both are the same. Sign-up and reset share it, so the guidance reads the same
 * wherever a password is chosen.
 */
export function NewPasswordFields({
  id,
  passwordLabel,
  confirmLabel,
  passwordRegistration,
  confirmRegistration,
  password,
  confirmation,
  assessment,
  passwordError,
  confirmError,
}: NewPasswordFieldsProps) {
  const guidanceId = `${id}-guidance`;
  const matchId = `${id}-match`;

  return (
    <>
      <PasswordField
        id={`${id}-password`}
        label={passwordLabel}
        autoComplete="new-password"
        error={passwordError}
        guidanceId={guidanceId}
        {...passwordRegistration}
      >
        <PasswordGuidance id={guidanceId} assessment={assessment} hasPassword={password !== ''} />
      </PasswordField>
      <PasswordField
        id={`${id}-confirm`}
        label={confirmLabel}
        autoComplete="new-password"
        error={confirmError}
        guidanceId={matchId}
        {...confirmRegistration}
      >
        <PasswordMatch id={matchId} password={password} confirmation={confirmation} />
      </PasswordField>
    </>
  );
}
