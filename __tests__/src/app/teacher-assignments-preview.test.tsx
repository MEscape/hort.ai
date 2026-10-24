import { describe, expect, it, vi } from 'vitest';

import type * as ServerConfiguration from '@lib/config/server';

import TeacherAssignmentsPage, {
  generateMetadata,
} from '@/app/[locale]/(public)/dev/teacher-assignments/page';

vi.mock('@lib/config/server', async (importOriginal) => {
  const actual = await importOriginal<typeof ServerConfiguration>();
  return { ...actual, serverEnv: { ...actual.serverEnv, NODE_ENV: 'production' } };
});

describe('development assignment route', () => {
  it('rejects the page and its metadata server-side in production', async () => {
    const props = { params: Promise.resolve({ locale: 'de' }) };
    expect(() => TeacherAssignmentsPage(props)).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    await expect(generateMetadata(props)).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});
