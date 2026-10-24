import { describe, expect, it } from 'vitest';

import {
  MAX_FIELDS,
  parseFields,
  requiredValidationCodes,
  resolveUnique,
} from '../../scripts/lib/fields';

describe('parseFields', () => {
  it('parses every kind, optionality and enum values', () => {
    expect(
      parseFields([
        'name:string',
        'note:string?',
        'qty:number',
        'price:money',
        'active:boolean',
        'dueAt:date?',
        'status:enum(draft|sent)',
      ]),
    ).toEqual([
      { name: 'name', kind: 'string', optional: false, enumValues: [] },
      { name: 'note', kind: 'string', optional: true, enumValues: [] },
      { name: 'qty', kind: 'number', optional: false, enumValues: [] },
      { name: 'price', kind: 'money', optional: false, enumValues: [] },
      { name: 'active', kind: 'boolean', optional: false, enumValues: [] },
      { name: 'dueAt', kind: 'date', optional: true, enumValues: [] },
      { name: 'status', kind: 'enum', optional: false, enumValues: ['draft', 'sent'] },
    ]);
  });

  it.each([
    [[], /At least one field/],
    [['name'], /Invalid field/],
    [['Name:string'], /Invalid field/],
    [['name:text'], /Unknown field type "text"/],
    [['id:string'], /cannot be a field name/],
    [['createdAt:date'], /cannot be a field name/],
    [['bag:string'], /cannot be a field name/],
    [['class:string'], /cannot be a field name/],
    [['a:string', 'a:number'], /Duplicate field "a"/],
    [['on:boolean?'], /cannot be optional/],
    [['x:string(a|b)'], /Only enum fields take values/],
    [['s:enum(a)'], /at least two values/],
    [['s:enum(a|A)'], /lowercase snake_case/],
    [['s:enum(a|a)'], /duplicate values/],
  ])('rejects %j', (specs, message) => {
    expect(() => parseFields(specs)).toThrow(message);
  });

  it('rejects more than the supported number of fields', () => {
    const many = Array.from({ length: MAX_FIELDS + 1 }, (_, index) => `f${index}:string`);
    expect(() => parseFields(many)).toThrow(/At most/);
  });
});

describe('resolveUnique', () => {
  const fields = parseFields(['name:string', 'note:string?', 'active:boolean']);

  it('returns the declared required fields', () => {
    expect(resolveUnique(['name'], fields).map((f) => f.name)).toEqual(['name']);
  });

  it.each([
    ['missing', /not a declared field/],
    ['note', /required, non-boolean/],
    ['active', /required, non-boolean/],
  ])('rejects %s', (name, message) => {
    expect(() => resolveUnique([name], fields)).toThrow(message);
  });
});

describe('requiredValidationCodes', () => {
  it('lists only the codes the fields can produce, in a stable order', () => {
    expect(requiredValidationCodes(parseFields(['on:boolean']))).toEqual([]);
    expect(requiredValidationCodes(parseFields(['a:string?', 'd:date']))).toEqual([
      'tooLong',
      'dateInvalid',
    ]);
    expect(requiredValidationCodes(parseFields(['a:string', 'm:money', 's:enum(x|y)']))).toEqual([
      'required',
      'tooLong',
      'amountInvalid',
      'optionUnknown',
    ]);
  });
});
