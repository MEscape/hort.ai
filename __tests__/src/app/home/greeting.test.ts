import { beforeEach, describe, expect, it } from 'vitest';

import {
  GREETING_COOLDOWN_MS,
  pickGreeting,
  shouldGreet,
} from '@/app/[locale]/(app)/home/_components/greeting';
import {
  readGreetingMemory,
  writeGreetingMemory,
} from '@/app/[locale]/(app)/home/_components/greeting-memory';

describe('pickGreeting', () => {
  it('is one short hello, said where the companion stands', () => {
    expect(pickGreeting({ hasUnfinished: false })).toEqual({ line: 'hello', target: 'stage' });
  });

  it('welcomes the child back and points at the waiting task when there is one', () => {
    expect(pickGreeting({ hasUnfinished: true })).toEqual({
      line: 'welcomeBack',
      target: 'continue',
    });
  });
});

describe('shouldGreet', () => {
  it('greets on a first arrival', () => {
    expect(shouldGreet(null, 1000)).toBe(true);
  });

  it('does not greet again within the cooldown (a refresh loop, a quick return)', () => {
    expect(shouldGreet({ line: 'a', at: 1000 }, 1000 + GREETING_COOLDOWN_MS - 1)).toBe(false);
  });

  it('greets again after the cooldown', () => {
    expect(shouldGreet({ line: 'a', at: 1000 }, 1000 + GREETING_COOLDOWN_MS)).toBe(true);
  });

  it('treats a memory from the future (a changed device clock) as old', () => {
    expect(shouldGreet({ line: 'a', at: 9_999_999 }, 1000)).toBe(true);
  });
});

describe('greeting memory', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('remembers the last line and when it was said', () => {
    writeGreetingMemory({ line: 'hello', at: 5 });
    expect(readGreetingMemory()).toEqual({ line: 'hello', at: 5 });
  });

  it('is empty at first and when the stored value is not what was written', () => {
    expect(readGreetingMemory()).toBeNull();
    window.sessionStorage.setItem('hortai.home.greeting', '{"line":3}');
    expect(readGreetingMemory()).toBeNull();
    window.sessionStorage.setItem('hortai.home.greeting', 'not json');
    expect(readGreetingMemory()).toBeNull();
  });

  it('works without storage: nothing throws, nothing is remembered', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    expect(() => {
      writeGreetingMemory({ line: 'a', at: 1 });
    }).not.toThrow();
    expect(readGreetingMemory()).toBeNull();
    if (original !== undefined) {
      Object.defineProperty(window, 'sessionStorage', original);
    }
  });
});
