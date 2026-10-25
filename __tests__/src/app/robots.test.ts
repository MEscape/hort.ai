import { describe, expect, it } from 'vitest';

import { I18N_CONFIG } from '@i18n';

import robots from '@/app/robots';

function disallowed(): string[] {
  const { rules } = robots();
  const [rule] = Array.isArray(rules) ? rules : [rules];
  const list = rule?.disallow ?? [];
  return typeof list === 'string' ? [list] : list;
}

describe('robots.txt', () => {
  it('lets crawlers in, and keeps them out of the API and the signed-in areas of every language', () => {
    const paths = disallowed();

    expect(paths).toContain('/api/');
    for (const locale of I18N_CONFIG.locales) {
      expect(paths).toContain(`/${locale}/home`);
      expect(paths).toContain(`/${locale}/onboarding`);
    }
  });

  it('does not block the pages that say "noindex" themselves: a blocked page never shows its tag', () => {
    const paths = disallowed().join(' ');

    expect(paths).not.toMatch(/sign-in|sign-up|welcome|forgot-password|reset-password/);
  });
});
