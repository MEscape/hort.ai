'use client';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS } from '../messages/message-keys';

import { RequirementList } from './requirement-list';
import { StrengthMeter } from './strength-meter';

import type { Requirement } from './requirement-list';
import type { PasswordAssessment } from '../password/password-strength';

export interface PasswordGuidanceProps {
  /** The id the password input points at with `aria-describedby`. */
  readonly id: string;
  /** How the password rates; worked out once by the form, which also lets Lumi react to it. */
  readonly assessment: PasswordAssessment;
  readonly hasPassword: boolean;
}

/**
 * Beneath a new-password field: how strong the password is, what it needs and what would make it
 * better, and one tip. Everything is worked out in the browser as the person types; only the length
 * is checked by the server.
 */
export function PasswordGuidance({ id, assessment, hasPassword }: PasswordGuidanceProps) {
  const t = useTranslations('auth');

  const requirements: Requirement[] = [
    {
      id: 'length',
      label: t('passwordGuidance.length', MESSAGE_PARAMS),
      isMet: assessment.isLongEnough,
      kind: 'required',
    },
    {
      id: 'common',
      label: t('passwordGuidance.notCommon'),
      isMet: hasPassword && assessment.isNotCommon,
      kind: 'recommended',
    },
    ...(assessment.avoidsPersonalInfo === null
      ? []
      : [
          {
            id: 'personal',
            label: t('passwordGuidance.avoidsPersonal'),
            isMet: hasPassword && assessment.avoidsPersonalInfo,
            kind: 'recommended' as const,
          },
        ]),
  ];

  return (
    <div
      id={id}
      className="flex flex-col gap-4 rounded-token-lg border border-border bg-highlight/60 p-4"
    >
      <StrengthMeter level={assessment.level} />
      <RequirementList requirements={requirements} />
      <p className="border-t border-border pt-3 text-base text-copy-muted">
        {t('passwordGuidance.tip')}
      </p>
    </div>
  );
}
