import type { ReactElement } from 'react';

import { describe, expect, it, vi } from 'vitest';

import StartPage from '@/app/[locale]/(public)/start/page';

const dependencies = vi.hoisted(() => ({
  ownChild: vi.fn(async () => ({ id: 'own-child' })),
  assignments: vi.fn(async (_id: string) => ({ isOk: () => true, value: [] })),
}));

vi.mock('@modules/learner', () => ({
  requireOnboarded: dependencies.ownChild,
  getLearnerQueries: () => ({
    getChildProfileById: {
      execute: async () => ({ isOk: () => true, value: { voiceConsent: true } }),
    },
  }),
}));
vi.mock('@modules/auth', () => ({ requireSignedIn: vi.fn() }));
vi.mock('@modules/assignments', () => ({
  assignmentsQueries: { listChildAssignments: { execute: dependencies.assignments } },
  parseChildTasksPageParams: (params: { child?: string }) => ({ childProfileId: params.child }),
}));
vi.mock('@components/providers/i18n-provider', () => ({ I18nProvider: () => null }));
vi.mock('@i18n', () => ({ requireLocale: () => 'en' }));
vi.mock('@i18n/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/app/[locale]/(public)/start/_components/start-page-shell', () => ({
  StartPageShell: () => null,
}));
vi.mock('@/app/[locale]/(public)/start/_components/start-screen', () => ({
  StartScreen: () => null,
}));

interface TreeProps {
  readonly children: ReactElement<TreeProps>;
}

/** Invoke the async server content inside its shell/provider/Suspense without a browser router. */
async function content(searchParams: Record<string, string>) {
  const page = await StartPage({
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve(searchParams),
  });
  const tree = page as ReactElement<TreeProps>;
  const inner = tree.props.children.props.children.props.children;
  const renderContent = inner.type as (props: unknown) => Promise<
    ReactElement<{
      childProfileId: string;
    }>
  >;
  return renderContent(inner.props);
}

describe('direct homework entry', () => {
  it('resolves the onboarded own child when /start has no child parameter', async () => {
    const screen = await content({});
    expect(screen.props.childProfileId).toBe('own-child');
    expect(dependencies.assignments).toHaveBeenCalledWith('own-child');
  });

  it('keeps an explicit child on the authorized assignment-query path', async () => {
    const screen = await content({ child: 'explicit-child' });
    expect(screen.props.childProfileId).toBe('explicit-child');
    expect(dependencies.assignments).toHaveBeenCalledWith('explicit-child');
  });
});
