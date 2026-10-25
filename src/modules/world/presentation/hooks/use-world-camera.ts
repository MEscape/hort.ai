'use client';

import { useEffect, useRef } from 'react';

import { useCalmMotion } from '@hooks/use-calm-motion';

import { clamp } from '@lib/utils';

import { WORLD_EXTENT, WORLD_HOME } from '../dto/world-layout-dto';

const DRAG_THRESHOLD = 8;
const PAN_STEP = 180;
const FRICTION = 0.88;
const MIN_SPEED = 0.03;
const MAX_SPEED = 1.2;
const FRAME_MS = 16;
const VELOCITY_MAX_AGE_MS = 80;

interface Point {
  readonly x: number;
  readonly y: number;
}
interface Gesture {
  readonly id: number;
  readonly from: Point;
  readonly camera: Point;
  last: Point;
  at: number;
  velocity: Point;
  moved: boolean;
}

/** The viewport's `--world-spread` (screen pixels per world unit): phones space the islands closer. */
function spreadOf(viewport: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(viewport).getPropertyValue('--world-spread'));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * One camera in world units, one animation frame. Pointer, wheel, keys and buttons all use the same
 * bounds; screen distances are divided by the spread, so a drag follows the finger at any spread.
 */
export function useWorldCamera() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const camera = useRef<Point>(WORLD_HOME);
  const size = useRef({ width: 0, height: 0 });
  const frame = useRef(0);
  const spread = useRef(1);
  const isCalm = useCalmMotion();

  const paint = (point: Point) => {
    const halfWidth = Math.min(size.current.width / 2 / spread.current, WORLD_EXTENT.width / 2);
    const halfHeight = Math.min(size.current.height / 2 / spread.current, WORLD_EXTENT.height / 2);
    camera.current = {
      x: clamp(point.x, halfWidth, WORLD_EXTENT.width - halfWidth),
      y: clamp(point.y, halfHeight, WORLD_EXTENT.height - halfHeight),
    };
    if (planeRef.current) {
      const { x, y } = camera.current;
      planeRef.current.style.transform = `translate3d(${-x * spread.current}px, ${-y * spread.current}px, 0)`;
    }
  };
  const focusAt = (point: Point) => {
    window.cancelAnimationFrame(frame.current);
    paint(point);
  };
  const pan = (x: number, y: number) => {
    const step = PAN_STEP / spread.current;
    focusAt({ x: camera.current.x + x * step, y: camera.current.y + y * step });
  };
  /** A short, visible flight, so the child sees where the place is (calm mode jumps). */
  const glideTo = (point: Point) => {
    if (planeRef.current && !isCalm) {
      planeRef.current.dataset['gliding'] = 'true';
    }
    focusAt(point);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }
    let gesture: Gesture | null = null;
    let swallowClick = false;
    const resize = () => {
      spread.current = spreadOf(viewport);
      size.current = { width: viewport.clientWidth, height: viewport.clientHeight };
      paint(camera.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    const landed = () => {
      if (planeRef.current) {
        delete planeRef.current.dataset['gliding'];
      }
    };
    const stop = () => {
      window.cancelAnimationFrame(frame.current);
      landed();
      gesture = null;
      delete viewport.dataset['dragging'];
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) {
        cancel();
        return;
      }
      stop();
      spread.current = spreadOf(viewport);
      swallowClick = false;
      const from = { x: event.clientX, y: event.clientY };
      gesture = {
        id: event.pointerId,
        from,
        last: from,
        camera: camera.current,
        at: event.timeStamp,
        velocity: { x: 0, y: 0 },
        moved: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (gesture?.id !== event.pointerId) {
        return;
      }
      const dx = event.clientX - gesture.from.x;
      const dy = event.clientY - gesture.from.y;
      if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
        return;
      }
      if (!gesture.moved) {
        gesture.moved = true;
        viewport.setPointerCapture(event.pointerId);
        viewport.dataset['dragging'] = 'true';
      }
      const elapsed = Math.max(1, event.timeStamp - gesture.at);
      gesture.velocity = {
        x: clamp((gesture.last.x - event.clientX) / elapsed, -MAX_SPEED, MAX_SPEED),
        y: clamp((gesture.last.y - event.clientY) / elapsed, -MAX_SPEED, MAX_SPEED),
      };
      gesture.last = { x: event.clientX, y: event.clientY };
      gesture.at = event.timeStamp;
      const point = {
        x: gesture.camera.x - dx / spread.current,
        y: gesture.camera.y - dy / spread.current,
      };
      window.cancelAnimationFrame(frame.current);
      frame.current = window.requestAnimationFrame(() => {
        paint(point);
      });
    };
    const finish = (event: PointerEvent) => {
      if (gesture?.id !== event.pointerId) {
        return;
      }
      const current = gesture;
      // Flush the last pointer position before starting inertia, including a quick release.
      if (current.moved) {
        paint({
          x: current.camera.x - (current.last.x - current.from.x) / spread.current,
          y: current.camera.y - (current.last.y - current.from.y) / spread.current,
        });
      }
      stop();
      swallowClick = current.moved;
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
      if (!current.moved || isCalm || event.timeStamp - current.at > VELOCITY_MAX_AGE_MS) {
        return;
      }
      let velocity = current.velocity;
      let previous = performance.now();
      const coast = (now: number) => {
        const dt = Math.min(FRAME_MS * 2, now - previous);
        previous = now;
        const distance = dt / spread.current;
        paint({
          x: camera.current.x + velocity.x * distance,
          y: camera.current.y + velocity.y * distance,
        });
        const decay = FRICTION ** (dt / FRAME_MS);
        velocity = { x: velocity.x * decay, y: velocity.y * decay };
        if (Math.hypot(velocity.x, velocity.y) > MIN_SPEED && !document.hidden) {
          frame.current = window.requestAnimationFrame(coast);
        }
      };
      frame.current = window.requestAnimationFrame(coast);
    };
    const cancel = () => {
      if (gesture === null) {
        return;
      }
      const id = gesture.id;
      swallowClick = gesture.moved;
      stop();
      if (viewport.hasPointerCapture(id)) {
        viewport.releasePointerCapture(id);
      }
    };
    const click = (event: MouseEvent) => {
      if (swallowClick && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        swallowClick = false;
      }
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        return;
      }
      event.preventDefault();
      focusAt({
        x: camera.current.x + event.deltaX / spread.current,
        y: camera.current.y + event.deltaY / spread.current,
      });
    };
    const key = (event: KeyboardEvent) => {
      const directions: Readonly<Record<string, Point>> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const direction = directions[event.key];
      if (direction) {
        event.preventDefault();
        pan(direction.x, direction.y);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        focusAt(WORLD_HOME);
      }
    };
    planeRef.current?.addEventListener('transitionend', landed);
    viewport.addEventListener('pointerdown', down);
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', finish);
    viewport.addEventListener('pointercancel', cancel);
    viewport.addEventListener('lostpointercapture', cancel);
    viewport.addEventListener('click', click, true);
    viewport.addEventListener('wheel', wheel, { passive: false });
    viewport.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', stop);
    return () => {
      cancel();
      stop();
      observer.disconnect();
      planeRef.current?.removeEventListener('transitionend', landed);
      viewport.removeEventListener('pointerdown', down);
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerup', finish);
      viewport.removeEventListener('pointercancel', cancel);
      viewport.removeEventListener('lostpointercapture', cancel);
      viewport.removeEventListener('click', click, true);
      viewport.removeEventListener('wheel', wheel);
      viewport.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [isCalm]);

  return {
    viewportRef,
    planeRef,
    focusAt,
    glideTo,
    reset: () => {
      glideTo(WORLD_HOME);
    },
  };
}
