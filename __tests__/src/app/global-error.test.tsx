import type * as NextNavigation from 'next/navigation';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GlobalError from '@/app/global-error';

const navigation = vi.hoisted(() => ({ pathname: '/en' }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof NextNavigation>()),
  usePathname: () => navigation.pathname,
}));
vi.mock('@lib/fonts', () => ({ fontVariables: 'fonts' }));

const render = () => renderToStaticMarkup(<GlobalError retry={() => undefined} />);

describe('global error page', () => {
  beforeEach(() => {
    navigation.pathname = '/en';
  });

  it('is a whole document of its own, because it replaces the root layout that failed', () => {
    const html = render();

    expect(html).toMatch(/^<html /);
    expect(html).toContain('<body');
  });

  it('speaks the language of the address the person was on', () => {
    navigation.pathname = '/de/home';

    const html = render();

    expect(html).toContain('lang="de"');
    expect(html).toContain('Etwas ist schiefgelaufen');
    expect(html).toContain('Erneut versuchen');
  });

  it('falls back to the default language for an address without a known language', () => {
    navigation.pathname = '/nowhere';

    const html = render();

    expect(html).toContain('lang="en"');
    expect(html).toContain('Something went wrong');
  });
});
