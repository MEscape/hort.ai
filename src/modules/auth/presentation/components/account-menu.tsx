'use client';

import { useSearchParams } from 'next/navigation';

import { Button } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { ChevronDown, House, LogOut, Settings } from '@components/ui/icons';

import { Link, usePathname } from '@i18n';

import { useTranslations } from '@i18n/client';

import { ROLE_LABEL_KEYS } from '../account/role-label-keys';
import { useSignOut } from '../hooks/use-sign-out';
import { authRoutes } from '../routes';

import { LanguageToggle } from './language-toggle';

import type { Role } from '../../application/contracts/auth-views';

interface AccountMenuProps {
  /** The display name chosen at sign-up (or changed in the settings); never an id. */
  readonly name: string;
  readonly role: Role;
  /** False in the parent area, where only "Return to the child" may leave (it closes access). */
  readonly showHome?: boolean;
}

/**
 * The signed-in person's name in the corner, opening the language toggle, Home, Account settings
 * and Sign out. The
 * initial in the circle is decoration; the button's name is the person's name and the menu purpose.
 */
export function AccountMenu({ name, role, showHome = true }: AccountMenuProps) {
  const t = useTranslations('auth');
  const signOut = useSignOut();
  // The settings page's back arrow returns here; the page re-checks it is a same-site path.
  const search = useSearchParams().toString();
  const here = `${usePathname()}${search === '' ? '' : `?${search}`}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="gap-2 px-2"
          aria-label={t('account.menuLabel', { name })}
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-primary font-heading text-base text-primary-foreground"
          >
            {name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="hidden max-w-48 truncate sm:inline">{name}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center justify-between gap-2">
          <DropdownMenuLabel className="min-w-0">
            <span className="block truncate font-semibold text-copy">{name}</span>
            <span className="block">{t(ROLE_LABEL_KEYS[role])}</span>
          </DropdownMenuLabel>
          <LanguageToggle />
        </div>
        <DropdownMenuSeparator />
        {showHome && (
          <DropdownMenuItem asChild>
            <Link href={authRoutes.home()}>
              <House aria-hidden="true" />
              {t('account.home')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={authRoutes.settings(here)}>
            <Settings aria-hidden="true" />
            {t('account.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signOut.isPending} onSelect={signOut.signOut}>
          <LogOut aria-hidden="true" />
          {signOut.isPending ? t('signOut.pending') : t('signOut.label')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
