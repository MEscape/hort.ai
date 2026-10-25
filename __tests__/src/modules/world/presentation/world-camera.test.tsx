import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WORLD_AREAS } from '@modules/world/domain/models/world-areas';
import {
  WORLD_EXTENT,
  WORLD_HOME,
  subjectRegion,
  worldPosition,
} from '@modules/world/presentation/dto/world-layout-dto';
import { useWorldCamera } from '@modules/world/presentation/hooks/use-world-camera';

function Camera() {
  const { viewportRef, planeRef } = useWorldCamera();
  return (
    <div ref={viewportRef} data-testid="viewport">
      <div ref={planeRef} data-testid="plane">
        <a href="#island">Island</a>
      </div>
    </div>
  );
}

function start() {
  render(<Camera />);
  const viewport = screen.getByTestId('viewport');
  const captured = new Set<number>();
  viewport.setPointerCapture = (id) => {
    captured.add(id);
  };
  viewport.hasPointerCapture = (id) => captured.has(id);
  viewport.releasePointerCapture = (id) => {
    captured.delete(id);
    fireEvent.lostPointerCapture(viewport, { pointerId: id });
  };
  const pointer = { pointerId: 1, isPrimary: true, button: 0, clientX: 200, clientY: 200 };
  fireEvent.pointerDown(viewport, pointer);
  return { viewport, pointer, captured, plane: screen.getByTestId('plane') };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('world camera', () => {
  it('moves in both axes and swallows the click after a drag', () => {
    const { viewport, pointer, plane } = start();
    fireEvent.pointerMove(viewport, { ...pointer, clientX: 250, clientY: 230 });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(plane.style.transform).toBe(
      `translate3d(${-WORLD_HOME.x + 50}px, ${-WORLD_HOME.y + 30}px, 0)`,
    );
    fireEvent.pointerUp(viewport, pointer);
    expect(fireEvent.click(screen.getByRole('link'), { detail: 1 })).toBe(false);
  });
  it('spaces the world by the viewport spread while a drag follows the finger', () => {
    render(<Camera />);
    const [viewport] = screen.getAllByTestId('viewport');
    if (viewport === undefined) {
      throw new Error('no viewport');
    }
    viewport.style.setProperty('--world-spread', '0.5');
    fireEvent(window, new Event('resize'));
    viewport.setPointerCapture = () => undefined;
    viewport.hasPointerCapture = () => false;
    fireEvent.keyDown(viewport, { key: 'Home' });
    fireEvent.pointerDown(viewport, {
      pointerId: 3,
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(viewport, { pointerId: 3, clientX: 50, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    const [plane] = screen.getAllByTestId('plane');
    expect(plane?.style.transform).toBe(
      `translate3d(${-WORLD_HOME.x * 0.5 + 50}px, ${-WORLD_HOME.y * 0.5}px, 0)`,
    );
  });

  it('keeps small finger movement as an island tap', () => {
    const { viewport, pointer } = start();
    fireEvent.pointerMove(viewport, { ...pointer, clientX: 203, clientY: 202 });
    fireEvent.pointerUp(viewport, pointer);
    expect(fireEvent.click(screen.getByRole('link'), { detail: 1 })).toBe(true);
  });
  it('releases capture on cancellation and leaves the next tap usable', () => {
    const { viewport, pointer, captured } = start();
    fireEvent.pointerMove(viewport, { ...pointer, clientX: 250 });
    fireEvent.pointerCancel(viewport, pointer);
    expect(captured.size).toBe(0);
    fireEvent.pointerDown(viewport, pointer);
    fireEvent.pointerUp(viewport, pointer);
    expect(fireEvent.click(screen.getByRole('link'), { detail: 1 })).toBe(true);
  });
  it('releases the first gesture when another touch interrupts it', () => {
    const { viewport, pointer, captured } = start();
    fireEvent.pointerMove(viewport, { ...pointer, clientX: 250 });
    fireEvent.pointerDown(viewport, { ...pointer, pointerId: 2, isPrimary: false });
    expect(captured.size).toBe(0);
  });
  it('never moves past the bounds and can always reset with the keyboard', () => {
    const { viewport, pointer, plane } = start();
    fireEvent.pointerMove(viewport, { ...pointer, clientX: 100000, clientY: 100000 });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(plane.style.transform).toBe('translate3d(0px, 0px, 0)');
    fireEvent.keyDown(viewport, { key: 'Home' });
    expect(plane.style.transform).toBe(`translate3d(${-WORLD_HOME.x}px, ${-WORLD_HOME.y}px, 0)`);
  });
});

it('never lets two islands crowd each other, even at the denser phone spacing', () => {
  // An island with its name, in world units at the phone spread: about 270 wide and 250 tall.
  const positions = WORLD_AREAS.map((area) => ({ id: area.id, ...worldPosition(area.id) }));
  const crowded = positions.flatMap((a, index) =>
    positions
      .slice(index + 1)
      .filter((b) => Math.abs(a.x - b.x) < 270 && Math.abs(a.y - b.y) < 250)
      .map((b) => `${a.id}~${b.id}`),
  );
  expect(crowded).toEqual([]);
});

it('gives every subject a region inside the world, its banner above its own islands', () => {
  for (const subject of new Set(WORLD_AREAS.map((area) => area.subject))) {
    const region = subjectRegion(subject);
    expect(region.center.x).toBeGreaterThan(0);
    expect(region.center.x).toBeLessThan(WORLD_EXTENT.width);
    expect(region.banner.y).toBeGreaterThan(0);
    const members = WORLD_AREAS.filter((area) => area.subject === subject).map((area) =>
      worldPosition(area.id),
    );
    expect(region.banner.y, subject).toBeLessThan(region.center.y);
    expect(members.some((position) => position.y > region.banner.y)).toBe(true);
  }
});

it('gives every world area a stable, distinct position inside the navigable world', () => {
  const positions = WORLD_AREAS.map((area) => worldPosition(area.id));
  expect(new Set(positions.map(({ x, y }) => `${x},${y}`)).size).toBe(WORLD_AREAS.length);
  for (const position of positions) {
    expect(position.x).toBeGreaterThan(0);
    expect(position.x).toBeLessThan(WORLD_EXTENT.width);
    expect(position.y).toBeGreaterThan(0);
    expect(position.y).toBeLessThan(WORLD_EXTENT.height);
  }
  expect(worldPosition('zahlenwald')).toEqual(worldPosition('zahlenwald'));
});
