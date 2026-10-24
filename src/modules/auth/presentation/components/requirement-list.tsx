'use client';

import { Check, Circle } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

export interface Requirement {
  readonly id: string;
  readonly label: string;
  readonly isMet: boolean;
  /** `required` is what the server refuses without; `recommended` is advice only. */
  readonly kind: 'required' | 'recommended';
}

export interface RequirementListProps {
  readonly requirements: readonly Requirement[];
}

const GROUPS = [
  { kind: 'required', labelKey: 'passwordGuidance.required' },
  { kind: 'recommended', labelKey: 'passwordGuidance.recommended' },
] as const;

/**
 * What a password should be, ticked off as it is typed, in two groups: what is needed and what is
 * only even better, so advice is never mistaken for a rule (or the other way round). Met or not is
 * said in words for screen readers too.
 */
export function RequirementList({ requirements }: RequirementListProps) {
  const t = useTranslations('auth');

  return (
    <div className="flex flex-col gap-3">
      {GROUPS.map(({ kind, labelKey }) => {
        const items = requirements.filter((requirement) => requirement.kind === kind);
        if (items.length === 0) {
          return null;
        }
        return (
          <div key={kind} className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold tracking-wide text-copy-muted uppercase">
              {t(labelKey)}
            </p>
            <ul aria-label={t(labelKey)} className="flex flex-col gap-1.5">
              {items.map(({ id, label, isMet }) => (
                <li key={id} className="flex items-start gap-2 text-base">
                  {isMet ? (
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Circle className="mt-1 size-4 shrink-0 text-copy-muted" aria-hidden="true" />
                  )}
                  <span className={cn(isMet ? 'text-copy' : 'text-copy-muted')}>
                    {label}
                    <span className="sr-only">
                      {' '}
                      {isMet ? t('passwordGuidance.met') : t('passwordGuidance.notMet')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
