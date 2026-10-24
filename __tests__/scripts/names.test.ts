import { describe, expect, it } from 'vitest';

import {
  assertKebabName,
  nameSet,
  pluralize,
  singularize,
  toCamel,
  toKebab,
  toPascal,
  toSnake,
  toUpperSnake,
} from '../../scripts/lib/names';

describe('case conversion', () => {
  it('converts between every spelling consistently', () => {
    expect(nameSet('order-item')).toEqual({
      kebab: 'order-item',
      pascal: 'OrderItem',
      camel: 'orderItem',
      snake: 'order_item',
      upperSnake: 'ORDER_ITEM',
    });
  });

  it('splits camelCase, PascalCase and acronyms', () => {
    expect(toKebab('orderItem')).toBe('order-item');
    expect(toKebab('OrderItem')).toBe('order-item');
    expect(toKebab('HTTPServer')).toBe('http-server');
    expect(toPascal('lesson_plans')).toBe('LessonPlans');
    expect(toCamel('Lesson Plans')).toBe('lessonPlans');
    expect(toSnake('lessonPlans')).toBe('lesson_plans');
    expect(toUpperSnake('lessonPlans')).toBe('LESSON_PLANS');
  });
});

describe('singularize / pluralize', () => {
  it.each([
    ['lesson-plans', 'lesson-plan'],
    ['lessons', 'lesson'],
    ['categories', 'category'],
    ['boxes', 'box'],
    ['status', 'status'],
    ['inventory', 'inventory'],
  ])('singularizes %s to %s', (input, expected) => {
    expect(singularize(input)).toBe(expected);
  });

  it.each([
    ['item', 'items'],
    ['category', 'categories'],
    ['box', 'boxes'],
    ['day', 'days'],
  ])('pluralizes %s to %s', (input, expected) => {
    expect(pluralize(input)).toBe(expected);
  });
});

describe('assertKebabName', () => {
  it.each(['order', 'order-items', 'a1', 'lesson-plans-v2'])('accepts %s', (name) => {
    expect(assertKebabName(name, 'module name')).toBe(name);
  });

  it.each([
    '',
    'Order',
    'order_items',
    'order items',
    '../x',
    'a/b',
    'a\\b',
    '-x',
    'x-',
    'a--b',
    '1abc',
    'x'.repeat(41),
    '.',
    '..',
    'x\0y',
  ])('rejects %j instead of rewriting it', (name) => {
    expect(() => assertKebabName(name, 'module name')).toThrow(/Invalid module name/);
  });

  it.each(['class', 'new-class', 'delete', 'default'])(
    'rejects the reserved word in %s',
    (name) => {
      expect(() => assertKebabName(name, 'stem')).toThrow(/reserved word/);
    },
  );
});
