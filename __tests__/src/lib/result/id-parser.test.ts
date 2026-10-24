import { describe, expect, it } from 'vitest';

import { notFoundError } from '@lib/errors';
import { createIdParser, err, ok, parseValidIds } from '@lib/result';
import type { AppResult } from '@lib/result';

type ItemId = string & { readonly __brand: 'ItemId' };

const parseItemId = createIdParser<ItemId, ReturnType<typeof notFoundError>>({
  isValid: (raw) => /^item-\d+$/.test(raw),
  brand: (raw) => raw as ItemId,
  mapError: () => notFoundError('item.not_found', 'No such item.'),
});

describe('createIdParser', () => {
  it('brands a valid id', () => {
    expect(parseItemId('item-1')._unsafeUnwrap()).toBe('item-1');
  });

  it('answers the mapped error for an invalid id', () => {
    expect(parseItemId('nope')._unsafeUnwrapErr()).toEqual(
      notFoundError('item.not_found', 'No such item.'),
    );
  });
});

describe('parseValidIds', () => {
  const parse = (raw: string): AppResult<ItemId> =>
    parseItemId(raw).match(
      (id) => ok(id),
      (error) => err(error),
    );

  it('drops malformed ids instead of failing the lookup', () => {
    expect(parseValidIds(['item-1', 'bad', 'item-2'], parse, 10)).toEqual(['item-1', 'item-2']);
  });

  it('keeps each id once', () => {
    expect(parseValidIds(['item-1', 'item-1', 'item-2'], parse, 10)).toEqual(['item-1', 'item-2']);
  });

  it('takes at most limit ids before parsing', () => {
    expect(parseValidIds(['item-1', 'item-2', 'item-3'], parse, 2)).toEqual(['item-1', 'item-2']);
  });

  it('returns nothing for no ids', () => {
    expect(parseValidIds([], parse, 5)).toEqual([]);
  });
});
