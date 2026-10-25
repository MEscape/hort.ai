import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';

import { usePictureState } from '@components/brand/use-picture-state';

it('allows a new picture to load after the preceding URL failed', () => {
  const { result, rerender } = renderHook(({ url }) => usePictureState(url), {
    initialProps: { url: '/first.webp' },
  });
  act(() => {
    result.current.markFailed();
  });
  expect(result.current.state).toBe('failed');
  rerender({ url: '/next.webp' });
  expect(result.current.state).toBe('pending');
});
