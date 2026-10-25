'use client';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { isKnownTrait, traitIconOf } from './trait-icons';

const TRAITS_SHOWN = 2;

export interface CompanionTraitsProps {
  readonly traits: readonly string[];
  readonly className?: string;
}

/**
 * Two words, each with a picture: what the companion is like. The words are translated by the
 * catalog's trait id; a trait nobody translated yet shows the catalog's German word, marked as such.
 */
export function CompanionTraits({ traits, className }: CompanionTraitsProps) {
  const t = useTranslations('learner');
  return (
    <ul className={cn('flex flex-wrap items-center justify-center gap-3', className)}>
      {traits.slice(0, TRAITS_SHOWN).map((trait) => {
        const Icon = traitIconOf(trait);
        return (
          <li
            key={trait}
            className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-5 pl-1.5 font-heading text-xl font-semibold text-copy shadow-soft"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            {isKnownTrait(trait) ? (
              <span>{t(`welcomeCompanion.traits.${trait}`)}</span>
            ) : (
              <span lang="de">{trait}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
