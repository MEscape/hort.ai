import { afterEach, describe, expect, it, vi } from 'vitest';

import { notFoundError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';

describe('escalate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an Error named after the code, keeping the app error as cause', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = notFoundError('thing.missing', 'Missing.');

    let thrown: unknown;
    try {
      escalate(error);
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toMatchObject({ message: 'thing.missing', cause: error });
  });

  it('logs the failure once with its code', () => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => escalate(notFoundError('thing.missing', 'Missing.'))).toThrow('thing.missing');

    expect(sink).toHaveBeenCalledTimes(1);
    const line: unknown = JSON.parse(String(sink.mock.calls[0]?.[0]));
    expect(line).toMatchObject({
      level: 'error',
      message: 'route.failed',
      context: { code: 'thing.missing' },
      error: { name: 'not_found', message: 'thing.missing' },
    });
  });
});
