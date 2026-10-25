import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CompanionAvatar } from '@modules/progression/presentation/components/companion-avatar';
import type { CompanionAvatarProps } from '@modules/progression/presentation/components/companion-avatar';
import type {
  BoredomLevel,
  CompanionMood,
} from '@modules/progression/presentation/dto/progress-dto';
import de from '@modules/progression/presentation/i18n/de.json';
import en from '@modules/progression/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import app from '@/i18n/messages/en.json';

const COMPANION = {
  name: 'Lili',
  imageUrl: 'https://storage.test/tutors/lili/mund-zu.svg',
  imageOpenUrl: 'https://storage.test/tutors/lili/mund-auf.svg',
};

function renderAvatar(
  mood: CompanionMood,
  boredomLevel: BoredomLevel = 0,
  reaction?: CompanionAvatarProps['reaction'],
) {
  return render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <CompanionAvatar
        companion={COMPANION}
        mood={mood}
        boredomLevel={boredomLevel}
        {...(reaction ? { reaction } : {})}
      />
    </I18nClientProvider>,
  );
}

/** Words a child must never read about the companion or about being away. */
const GUILT =
  /sad|lonely|alone|miss(?:ed|es)?\b|disappoint|abandon|neglect|need(?:s)? you|waiting|late|hurry|streak|traurig|einsam|vermiss|enttäusch|verlassen|braucht dich|wartet|verpasst|beeil|serie/i;

describe('CompanionAvatar', () => {
  it.each([
    ['new', 'Lili waves hello, curious to meet you.'],
    ['cheerful', 'Lili is happy you are here!'],
    ['calm', 'Lili is relaxed and happy to see you.'],
    ['sleepy', 'Lili is sleepy and happy to see you.'],
    ['bored', 'Lili yawns and would love a snack.'],
  ] as const)('describes a %s companion warmly', (mood, alt) => {
    renderAvatar(mood);
    expect(screen.getByRole('img', { name: alt })).toBeVisible();
  });

  it('idles by how bored it is: lively, relaxed, then only breathing', () => {
    const idleOf = (mood: CompanionMood, level: BoredomLevel) => {
      const { container, unmount } = renderAvatar(mood, level);
      const classes = ['lively', 'calm', 'sleepy', 'wave'].filter(
        (name) => container.querySelector(`.animate-companion-${name}`) !== null,
      );
      unmount();
      return classes;
    };
    expect(idleOf('cheerful', 0)).toEqual(['lively']);
    expect(idleOf('new', 0)).toEqual(['wave']);
    expect(idleOf('calm', 1)).toEqual(['calm']);
    expect(idleOf('sleepy', 2)).toEqual(['sleepy']);
    expect(idleOf('bored', 3)).toEqual(['sleepy']);
    expect(idleOf('bored', 4)).toEqual(['sleepy']);
  });

  it('shows the thought bubble with its treat only when very bored, and never as a sad face', () => {
    for (const level of [0, 1, 2, 3] as const) {
      const { container, unmount } = renderAvatar('bored', level);
      expect(container.querySelector('[data-thought="snack"]')).toBeNull();
      unmount();
    }
    const { container } = renderAvatar('bored', 4);
    expect(container.querySelector('[data-thought="snack"]')).not.toBeNull();
    expect(container.querySelector('[data-boredom="4"]')).not.toBeNull();
  });

  it('answers a confirmed event with a hop or a cheer, and otherwise stays idle', () => {
    expect(
      renderAvatar('cheerful', 0, 'hop').container.querySelector('.animate-hop'),
    ).not.toBeNull();
    expect(
      renderAvatar('cheerful', 0, 'cheer').container.querySelector('.animate-companion-cheer'),
    ).not.toBeNull();
    expect(renderAvatar('cheerful').container.querySelector('.animate-hop')).toBeNull();
  });

  it('stops idling while it reacts, so the reaction reads clearly', () => {
    const { container } = renderAvatar('cheerful', 0, 'chew');
    expect(container.querySelector('.animate-companion-lively')).toBeNull();
    expect(container.querySelector('.animate-companion-chew')).not.toBeNull();
  });
});

describe('progression copy', () => {
  it('has a warm line for every mood in both languages, sleepy and bored included', () => {
    for (const catalog of [en, de]) {
      for (const mood of ['new', 'cheerful', 'calm', 'sleepy', 'bored'] as const) {
        expect(catalog.progression.mood[mood]).toEqual(expect.stringContaining('{name}'));
      }
    }
  });

  it('never makes a child feel guilty, sad, hurried or counted', () => {
    const texts = (catalog: typeof en) => JSON.stringify(catalog.progression);
    expect(texts(en)).not.toMatch(GUILT);
    expect(texts(de)).not.toMatch(GUILT);
  });

  it('keeps both languages in step: the same keys and the same placeholders', () => {
    const flat = (value: unknown, prefix = ''): Record<string, string> =>
      Object.entries(value as Record<string, unknown>).reduce(
        (all, [key, entry]) =>
          typeof entry === 'string'
            ? { ...all, [`${prefix}${key}`]: entry }
            : { ...all, ...flat(entry, `${prefix}${key}.`) },
        {},
      );
    const names = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((match) => match[1]).sort();
    const english = flat(en.progression);
    const german = flat(de.progression);

    expect(Object.keys(german).sort()).toEqual(Object.keys(english).sort());
    for (const [key, text] of Object.entries(english)) {
      expect(text.trim(), key).not.toBe('');
      expect(names(german[key] ?? ''), key).toEqual(names(text));
    }
  });
});
