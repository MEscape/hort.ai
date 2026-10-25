import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import HelpPage from '@/app/[locale]/(app)/help/page';
import StartPage from '@/app/[locale]/(public)/start/page';

const OPEN = { sessionId: 's1', task: 'Add 347 and 256', assignmentId: null };
const SCENE = {
  sessionId: 's1',
  kind: 'number-line',
  scene: { template: 'number-line', sceneVersion: 1, start: 8, jump: 5 },
};

const deps = vi.hoisted(() => ({
  ownChild: vi.fn(async () => ({ id: 'own-child', tutorId: 'max' })),
  assignments: vi.fn(async (_id: string) => ({ isOk: () => true, value: [] as unknown[] })),
  openSession: vi.fn(async (_id: string): Promise<unknown> => null),
  taskScene: vi.fn(async (_id: string): Promise<unknown> => null),
  clearedAreas: vi.fn(
    async (_id: string): Promise<ReadonlySet<string> | undefined> => new Set(['zahlenwald']),
  ),
  redirect: vi.fn((_target: unknown) => {
    throw new Error('redirected');
  }),
}));

vi.mock('@modules/learner', () => ({
  requireOnboarded: deps.ownChild,
  learnerRoutes: { home: () => '/home' },
}));
vi.mock('@modules/auth', () => ({ requireSignedIn: vi.fn() }));
vi.mock('@modules/assignments', () => ({
  assignmentsQueries: { listChildAssignments: { execute: deps.assignments } },
}));
vi.mock('@modules/guidance', () => ({ loadOpenHelpSession: deps.openSession }));
vi.mock('@modules/guidance/client', () => ({ HelpConversation: () => null }));
vi.mock('@modules/lesson', () => ({ loadTaskSceneDto: deps.taskScene }));
vi.mock('@modules/lesson/client', () => ({ TaskScene: () => null }));
vi.mock('@/app/[locale]/(app)/onboarding/tutor-options', () => ({
  buildTutorOptions: () => [{ id: 'max', name: 'Max' }],
  preloadTutorPictures: vi.fn(),
}));
vi.mock('@/app/_lib/homework-area-ids', () => ({
  loadHomeworkAreaIds: deps.clearedAreas,
}));
vi.mock('@components/providers/i18n-provider', () => ({ I18nProvider: () => null }));
vi.mock('@i18n', () => ({ requireLocale: () => 'en', Link: () => null, redirect: deps.redirect }));
vi.mock('@i18n/server', async () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({ app: (await import('@/i18n/messages/en.json')).default }),
}));

interface AnyProps {
  readonly children?: ReactNode;
  readonly searchParams?: unknown;
  readonly [key: string]: unknown;
}

/** The first element in a server tree whose props hold `searchParams`: the async page content. */
function findContent(node: ReactNode): ReactElement<AnyProps> | undefined {
  if (!isValidElement<AnyProps>(node)) {
    return Array.isArray(node) ? node.map(findContent).find(Boolean) : undefined;
  }
  if (node.props.searchParams !== undefined) {
    return node;
  }
  const children = node.props.children;
  return (Array.isArray(children) ? children : [children]).map(findContent).find(Boolean);
}

async function content(searchParams: Record<string, string>) {
  const page = await HelpPage({
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve(searchParams),
  });
  const inner = findContent(page);
  if (inner === undefined) {
    throw new Error('No page content found.');
  }
  const render = inner.type as (props: unknown) => Promise<ReactElement<AnyProps>>;
  return render(inner.props);
}

describe('the help canvas page', () => {
  beforeEach(() => {
    deps.openSession.mockResolvedValue(null);
    deps.taskScene.mockResolvedValue(null);
  });

  it('asks for a task on the stage when none is open', async () => {
    const screen = await content({});

    expect(screen.props['childProfileId']).toBe('own-child');
    expect(screen.props['openTask']).toBeNull();
    expect(deps.assignments).toHaveBeenCalledWith('own-child');
  });

  it('shows the open session with its planned example scene', async () => {
    deps.openSession.mockResolvedValue(OPEN);
    deps.taskScene.mockResolvedValue(SCENE);

    const screen = await content({});

    expect(screen.props['initial']).toEqual(OPEN);
    expect(deps.taskScene).toHaveBeenCalledWith('own-child');
    expect(isValidElement(screen.props['scene'])).toBe(true);
  });

  it('draws no scene when the task has nothing a template can draw', async () => {
    deps.openSession.mockResolvedValue(OPEN);

    expect((await content({})).props['scene']).toBeNull();
  });

  it('asks for a new task while one is open, handing the open one on so it is never silently replaced', async () => {
    deps.openSession.mockResolvedValue(OPEN);

    const screen = await content({ new: '1' });

    expect(screen.props['openTask']).toEqual({ task: 'Add 347 and 256', assignmentId: null });
  });

  it('hands a validated island and place on as the task’s context', async () => {
    const screen = await content({ new: '1', area: 'zahlenwald', place: 'plus-mulde' });

    expect(screen.props['topic']).toEqual({
      areaId: 'zahlenwald',
      placeId: 'plus-mulde',
      subject: 'math',
      name: 'Number Forest · Addition Hollow',
    });
  });

  it('drops an island the child has not cleared, or when the record cannot be read', async () => {
    deps.clearedAreas.mockResolvedValueOnce(new Set());
    expect((await content({ area: 'zahlenwald', place: 'plus-mulde' })).props['topic']).toBeNull();
    deps.clearedAreas.mockResolvedValueOnce(undefined);
    expect((await content({ area: 'zahlenwald', place: 'plus-mulde' })).props['topic']).toBeNull();
  });

  it('drops an island or place that does not exist instead of guessing one', async () => {
    expect((await content({ area: 'atlantis' })).props['topic']).toBeNull();
    expect(
      (await content({ area: 'maerchenwald', place: 'plus-mulde' })).props['topic'],
    ).toBeNull();
  });
});

describe('the old start page', () => {
  async function redirectOf(searchParams: Record<string, string>) {
    const page = StartPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve(searchParams),
    }) as ReactElement<AnyProps>;
    const inner = page.props.children as ReactElement<AnyProps>;
    await expect((inner.type as (props: unknown) => Promise<never>)(inner.props)).rejects.toThrow(
      'redirected',
    );
    return deps.redirect.mock.calls.at(-1)?.[0];
  }

  it('sends old links to the help canvas', async () => {
    expect(await redirectOf({})).toEqual({ href: '/help', locale: 'en' });
  });

  it('keeps an island link’s area and place and asks for a new task', async () => {
    expect(await redirectOf({ area: 'zahlenwald', place: 'plus-mulde' })).toEqual({
      href: '/help?new=1&area=zahlenwald&place=plus-mulde',
      locale: 'en',
    });
  });
});
