import { useState } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CharacterCarousel } from '@components/shared/character-carousel';
import type { CarouselCharacter } from '@components/shared/character-carousel';

import { stubMotion } from './fake-audio';

const CHARACTERS: CarouselCharacter[] = [
  { id: 'max', name: 'Max', imageUrl: '/max.svg', imageOpenUrl: '/max-open.svg' },
  {
    id: 'lili',
    name: 'Lili',
    imageUrl: '/lili.svg',
    imageOpenUrl: '/lili-open.svg',
    badge: 'Fits you',
  },
  { id: 'fina', name: 'Fina', imageUrl: '/fina.svg', imageOpenUrl: '/fina-open.svg' },
  { id: 'otto', name: 'Otto', imageUrl: '/otto.svg', imageOpenUrl: '/otto-open.svg' },
];

const LABELS = {
  group: 'Companions',
  previous: 'Previous companion',
  next: 'Next companion',
  selected: (name: string, position: number, total: number) =>
    `${name}, ${position} of ${total}, selected`,
};

function Harness({ start = 'max' }: { start?: string }) {
  const [activeId, setActiveId] = useState(start);
  return (
    <>
      <CharacterCarousel
        characters={CHARACTERS}
        activeId={activeId}
        onActiveChange={setActiveId}
        labels={LABELS}
      />
      <span data-testid="chosen">{activeId}</span>
    </>
  );
}

const chosen = () => screen.getByTestId('chosen').textContent;
const listbox = () => screen.getByRole('listbox', { name: 'Companions' });
// The drag lives on the stage around the listbox, which also holds the transparent tap areas.
const track = () => listbox().parentElement!;

/** A finger (or mouse) pressing at `from`, moving by each x in turn, and letting go. */
function drag(from: number, ...moves: number[]) {
  fireEvent.pointerDown(listbox(), { pointerId: 1, pointerType: 'touch', clientX: from });
  for (const x of moves) {
    fireEvent.pointerMove(listbox(), { pointerId: 1, pointerType: 'touch', clientX: x });
  }
  fireEvent.pointerUp(listbox(), { pointerId: 1, pointerType: 'touch' });
}

describe('CharacterCarousel', () => {
  beforeEach(() => {
    stubMotion(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['motion'];
  });

  it('is one listbox whose active option is the selection, with the neighbours visible', () => {
    render(<Harness start="lili" />);
    expect(listbox()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Lili/ }).id,
    );
    expect(screen.getByRole('option', { selected: true, name: /Lili/ })).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('option', { name: /Max/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Fits you')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Lili, 2 of 4, selected');
  });

  it('names the active one in big type with a tick, and shows the mark as text only on the active one', () => {
    render(<Harness start="lili" />);
    const name = screen.getAllByText('Lili').find((element) => !element.closest('[role="option"]'));
    expect(name).toHaveTextContent('Lili');
    expect(name?.querySelector('svg')).toBeInTheDocument();
    fireEvent.keyDown(listbox(), { key: 'ArrowRight' });
    expect(screen.getByText('Fits you')).toHaveClass('sr-only');
  });

  it('changes the real selected id with the arrow keys, Home and End, and stops at the ends', () => {
    render(<Harness />);
    fireEvent.keyDown(listbox(), { key: 'ArrowRight' });
    expect(chosen()).toBe('lili');
    expect(screen.getByRole('status')).toHaveTextContent('Lili, 2 of 4, selected');
    fireEvent.keyDown(listbox(), { key: 'ArrowRight' });
    expect(chosen()).toBe('fina');
    fireEvent.keyDown(listbox(), { key: 'ArrowLeft' });
    expect(chosen()).toBe('lili');
    fireEvent.keyDown(listbox(), { key: 'End' });
    expect(chosen()).toBe('otto');
    fireEvent.keyDown(listbox(), { key: 'ArrowRight' });
    expect(chosen()).toBe('otto');
    fireEvent.keyDown(listbox(), { key: 'Home' });
    expect(chosen()).toBe('max');
    fireEvent.keyDown(listbox(), { key: 'ArrowLeft' });
    expect(chosen()).toBe('max');
  });

  it('steps with the previous and next buttons and keeps them focusable but inert at the ends', () => {
    render(<Harness />);
    const previous = screen.getByRole('button', { name: 'Previous companion' });
    const next = screen.getByRole('button', { name: 'Next companion' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(previous);
    expect(chosen()).toBe('max');

    fireEvent.click(next);
    expect(chosen()).toBe('lili');
    expect(previous).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(previous);
    expect(chosen()).toBe('max');
  });

  it('chooses a neighbour with a tap, and a tap on the active one changes nothing', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('option', { name: /Lili/ }));
    expect(chosen()).toBe('lili');
    fireEvent.click(screen.getByRole('option', { name: /Lili/ }));
    expect(chosen()).toBe('lili');
  });

  it('steps to the neighbour with a tap on the edge of the stage, where the neighbour peeks out', () => {
    render(<Harness />);
    expect(screen.queryByTestId('tap-previous')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tap-next'));
    expect(chosen()).toBe('lili');
    fireEvent.click(screen.getByTestId('tap-previous'));
    expect(chosen()).toBe('max');
  });

  it('keeps the edge tap areas out of the tab order and the accessibility tree', () => {
    render(<Harness start="lili" />);
    for (const id of ['tap-previous', 'tap-next']) {
      expect(screen.getByTestId(id)).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId(id)).toHaveAttribute('tabindex', '-1');
    }
  });

  it('steps when a drag goes far enough, in the direction of the drag', () => {
    render(<Harness start="lili" />);
    drag(200, 180, 120);
    expect(chosen()).toBe('fina');
    drag(100, 130, 190);
    expect(chosen()).toBe('lili');
  });

  it('follows the finger while dragging and settles back afterwards', () => {
    render(<Harness />);
    fireEvent.pointerDown(listbox(), { pointerId: 1, pointerType: 'touch', clientX: 200 });
    fireEvent.pointerMove(listbox(), { pointerId: 1, pointerType: 'touch', clientX: 160 });
    expect(track()).toHaveAttribute('data-dragging', 'true');
    expect(track().style.getPropertyValue('--drag')).toBe('-40px');
    fireEvent.pointerUp(listbox(), { pointerId: 1, pointerType: 'touch' });
    expect(track()).not.toHaveAttribute('data-dragging');
    expect(track().style.getPropertyValue('--drag')).toBe('0px');
  });

  it('does not step for a short drag or a wobbly tap, and the tap still reaches the slide', () => {
    render(<Harness />);
    drag(200, 190, 170);
    expect(chosen()).toBe('max');
    drag(200, 203, 198);
    expect(chosen()).toBe('max');
    fireEvent.click(screen.getByRole('option', { name: /Lili/ }));
    expect(chosen()).toBe('lili');
  });

  it('swallows the click that ends a drag, so letting go over a slide does not choose it', () => {
    render(<Harness />);
    drag(200, 190, 170);
    fireEvent.click(screen.getByRole('option', { name: /Lili/ }));
    expect(chosen()).toBe('max');
    fireEvent.click(screen.getByRole('option', { name: /Lili/ }));
    expect(chosen()).toBe('lili');
  });

  it('gives only a little at the ends and never steps past them', () => {
    render(<Harness />);
    fireEvent.pointerDown(listbox(), { pointerId: 1, pointerType: 'touch', clientX: 100 });
    fireEvent.pointerMove(listbox(), { pointerId: 1, pointerType: 'touch', clientX: 200 });
    expect(track().style.getPropertyValue('--drag')).toBe('25px');
    fireEvent.pointerUp(listbox(), { pointerId: 1, pointerType: 'touch' });
    expect(chosen()).toBe('max');
  });

  it('ignores a cancelled gesture and the secondary mouse button', () => {
    render(<Harness />);
    fireEvent.pointerDown(listbox(), { pointerId: 1, pointerType: 'touch', clientX: 200 });
    fireEvent.pointerMove(listbox(), { pointerId: 1, pointerType: 'touch', clientX: 100 });
    fireEvent.pointerCancel(listbox(), { pointerId: 1, pointerType: 'touch' });
    expect(chosen()).toBe('max');

    fireEvent.pointerDown(listbox(), {
      pointerId: 2,
      pointerType: 'mouse',
      button: 2,
      clientX: 200,
    });
    fireEvent.pointerMove(listbox(), { pointerId: 2, pointerType: 'mouse', clientX: 100 });
    fireEvent.pointerUp(listbox(), { pointerId: 2, pointerType: 'mouse' });
    expect(chosen()).toBe('max');
  });

  it('bobs the active character and hops it after a change', () => {
    render(<Harness />);
    expect(document.querySelectorAll('.animate-float')).toHaveLength(1);
    expect(document.querySelectorAll('.animate-hop')).toHaveLength(0);
    fireEvent.keyDown(listbox(), { key: 'ArrowRight' });
    const hopping = document.querySelectorAll('.animate-hop');
    expect(hopping).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Lili/ })).toContainElement(
      hopping[0] as HTMLElement,
    );
  });

  it('leaves out the bob and the hop with reduced motion, and still works', () => {
    stubMotion(true);
    render(<Harness />);
    fireEvent.keyDown(listbox(), { key: 'ArrowRight' });
    expect(chosen()).toBe('lili');
    expect(document.querySelectorAll('.animate-float, .animate-hop')).toHaveLength(0);
    expect(screen.getByRole('option', { selected: true, name: /Lili/ })).toBeVisible();
  });

  it('leaves out the bob and the hop in the in-app calm mode', () => {
    document.documentElement.dataset['motion'] = 'calm';
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Next companion' }));
    expect(document.querySelectorAll('.animate-float, .animate-hop')).toHaveLength(0);
  });

  it('follows the calm setting when it is switched while open', async () => {
    render(<Harness />);
    expect(document.querySelectorAll('.animate-float')).toHaveLength(1);
    await act(async () => {
      document.documentElement.dataset['motion'] = 'calm';
      await Promise.resolve();
    });
    expect(document.querySelectorAll('.animate-float')).toHaveLength(0);
  });

  it('loads every closed picture at once, the open mouth only for the active one', () => {
    render(<Harness />);
    const first = (name: RegExp) => screen.getByRole('option', { name }).querySelector('img');
    expect(first(/Max/)).not.toHaveAttribute('loading', 'lazy');
    expect(first(/Max/)).toHaveAttribute('fetchpriority', 'high');
    expect(first(/Lili/)).not.toHaveAttribute('loading', 'lazy');
    expect(first(/Fina/)).not.toHaveAttribute('loading', 'lazy');
    expect(first(/Otto/)).not.toHaveAttribute('loading', 'lazy');
    const sources = [...document.querySelectorAll('img')].map((image) => image.getAttribute('src'));
    expect(sources).toContain('/max-open.svg');
    expect(sources).not.toContain('/lili-open.svg');
    expect(sources).not.toContain('/fina-open.svg');
  });

  it('paints no ground shadow under the characters', () => {
    render(<Harness />);
    expect(document.querySelector('[class*="bg-primary/15"]')).not.toBeInTheDocument();
  });
});
