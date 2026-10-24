import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createActionInputParser } from '@lib/actions';
import { ROOT_FIELD } from '@lib/errors';

const parse = createActionInputParser('profile.invalid_input');

describe('createActionInputParser', () => {
  const schema = z.object({
    name: z.string().min(2),
    address: z.object({ city: z.string() }),
    tags: z.array(z.string()),
  });

  it('returns the parsed value of valid input', () => {
    const input = { name: 'Ada', address: { city: 'Berlin' }, tags: ['a'] };

    expect(parse(schema, input)._unsafeUnwrap()).toEqual(input);
  });

  it('reports every issue under its dotted field path', () => {
    const error = parse(schema, { name: 'A', address: {}, tags: [1] })._unsafeUnwrapErr();

    expect(error).toMatchObject({
      kind: 'validation',
      code: 'profile.invalid_input',
      message: 'The request input is invalid.',
    });
    expect(Object.keys(error.fieldErrors).sort()).toEqual(['address.city', 'name', 'tags.0']);
  });

  it('groups several messages of one path', () => {
    const both = z.string().superRefine((_, context) => {
      context.addIssue({ code: 'custom', message: 'first' });
      context.addIssue({ code: 'custom', message: 'second' });
    });

    expect(parse(both, 'x')._unsafeUnwrapErr().fieldErrors).toEqual({
      [ROOT_FIELD]: ['first', 'second'],
    });
  });

  it('files an issue without a path under the root field', () => {
    expect(parse(schema, 'not an object')._unsafeUnwrapErr().fieldErrors).toHaveProperty(
      ROOT_FIELD,
    );
  });

  it('accepts a record key named like a prototype member', () => {
    const record = z.record(z.string(), z.number());
    const input = JSON.parse('{"constructor":"x"}') as unknown;

    expect(parse(record, input)._unsafeUnwrapErr().fieldErrors.constructor).toHaveLength(1);
  });
});
