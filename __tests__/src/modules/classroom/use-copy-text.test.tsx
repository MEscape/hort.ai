import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useCopyText } from '@modules/classroom/presentation/hooks/use-copy-text';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('does not report a copy of the old text for a replaced one', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  const { result, rerender } = renderHook(({ text }) => useCopyText(text), {
    initialProps: { text: 'ABCD-EFGH' },
  });

  await act(async () => {
    result.current.copy();
  });
  expect(result.current.state).toBe('copied');

  rerender({ text: 'JKMN-PRTU' });
  expect(result.current.state).toBe('idle');
});

it('reports a refused copy', async () => {
  vi.stubGlobal('navigator', {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  const { result } = renderHook(() => useCopyText('ABCD-EFGH'));

  await act(async () => {
    result.current.copy();
  });

  expect(result.current.state).toBe('failed');
});
