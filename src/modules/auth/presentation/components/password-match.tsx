'use client';

import { FieldMessage } from '@components/shared/field-message';

import { useTranslations } from '@i18n/client';

export interface PasswordMatchProps {
  readonly id: string;
  readonly password: string;
  readonly confirmation: string;
}

/**
 * Under the repeat field: a tick once both passwords are the same, so a person knows before
 * submitting. A mismatch is the field's own error, shown when they leave it; nothing is drawn
 * while the field is empty.
 */
export function PasswordMatch({ id, password, confirmation }: PasswordMatchProps) {
  const t = useTranslations('auth');
  if (confirmation === '' || confirmation !== password) {
    return null;
  }
  return (
    <div role="status">
      <FieldMessage id={id} tone="success">
        {t('passwordGuidance.match')}
      </FieldMessage>
    </div>
  );
}
