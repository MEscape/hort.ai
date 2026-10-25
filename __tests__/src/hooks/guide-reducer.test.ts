import { describe, expect, it } from 'vitest';

import { INITIAL_GUIDE, dwellMsFor, guideReducer, isGuideSpeaking } from '@hooks/guide-reducer';
import type { GuideAction, GuideState } from '@hooks/guide-reducer';

const run = (actions: readonly GuideAction[], from: GuideState = INITIAL_GUIDE): GuideState =>
  actions.reduce(guideReducer, from);

const point = (target: string, line: string, moves = true): GuideAction => ({
  type: 'point',
  target,
  line,
  moves,
});

describe('guideReducer', () => {
  it('rejects an arrival from an interrupted interaction even while walking again', () => {
    const first = run([point('teacher', 'a')]);
    const second = run([point('world', 'b')], first);
    expect(guideReducer(second, { type: 'arrived', seq: first.seq })).toBe(second);
  });

  it('invalidates queued completions as soon as it is stopped', () => {
    const first = run([point('teacher', 'a'), { type: 'arrived' }]);
    const stopped = guideReducer(first, { type: 'stop' });
    expect(stopped.seq).toBeGreaterThan(first.seq);
  });
  it('starts at home with nothing to say and no bubble', () => {
    expect(INITIAL_GUIDE.phase).toBe('home');
    expect(isGuideSpeaking(INITIAL_GUIDE)).toBe(false);
  });

  it('walks to the target first and speaks once it has arrived', () => {
    const walking = run([point('teacher', 'teacher.empty')]);
    expect(walking).toMatchObject({ phase: 'walking', target: 'teacher', line: 'teacher.empty' });
    expect(isGuideSpeaking(walking)).toBe(false);

    const speaking = run([{ type: 'arrived' }], walking);
    expect(speaking.phase).toBe('speaking');
    expect(isGuideSpeaking(speaking)).toBe(true);
  });

  it('speaks at once, without walking, when it does not move (calm mode or the stage itself)', () => {
    const state = run([point('stage', 'greeting.morning', false)]);
    expect(state.phase).toBe('speaking');
  });

  it('walks back after speaking and is home again when it got there, line and target cleared', () => {
    const speaking = run([point('teacher', 'a'), { type: 'arrived' }]);
    const returning = run([{ type: 'spoken' }], speaking);
    expect(returning.phase).toBe('returning');
    expect(isGuideSpeaking(returning)).toBe(false);

    expect(run([{ type: 'returned' }], returning)).toEqual({
      ...INITIAL_GUIDE,
      seq: returning.seq,
    });
  });

  it('goes straight home after speaking when it never moved', () => {
    const state = run([point('stage', 'a', false), { type: 'spoken' }]);
    expect(state.phase).toBe('home');
    expect(state.line).toBeNull();
  });

  it('lets a new tap replace the current line at once: no queue, one line at a time', () => {
    const first = run([point('teacher', 'a'), { type: 'arrived' }]);
    const second = run([point('world', 'b')], first);
    expect(second).toMatchObject({ phase: 'walking', target: 'world', line: 'b' });
    expect(second.seq).toBeGreaterThan(first.seq);
  });

  it('stops while speaking: the bubble goes away and it walks home', () => {
    const state = run([point('teacher', 'a'), { type: 'arrived' }, { type: 'stop' }]);
    expect(state.phase).toBe('returning');
    expect(state.line).toBeNull();
    expect(isGuideSpeaking(state)).toBe(false);
  });

  it('stops while walking: it turns around', () => {
    expect(run([point('teacher', 'a'), { type: 'stop' }]).phase).toBe('returning');
  });

  it('stops without walking when it never moved, and does nothing when it is home', () => {
    expect(run([point('stage', 'a', false), { type: 'stop' }]).phase).toBe('home');
    expect(run([{ type: 'stop' }])).toBe(INITIAL_GUIDE);
  });

  it('ignores events that do not fit the phase (a late timer after a new tap)', () => {
    const walking = run([point('teacher', 'a')]);
    expect(run([{ type: 'spoken' }], walking)).toBe(walking);
    expect(run([{ type: 'returned' }], walking)).toBe(walking);
    const speaking = run([{ type: 'arrived' }], walking);
    expect(run([{ type: 'arrived' }], speaking)).toBe(speaking);
    expect(run([{ type: 'arrived' }])).toBe(INITIAL_GUIDE);
  });
});

describe('dwellMsFor', () => {
  it('gives a short line a calm minimum and a longer one more time, up to a cap', () => {
    expect(dwellMsFor('Hi!')).toBe(dwellMsFor('Hello!'));
    expect(dwellMsFor('x'.repeat(40))).toBeGreaterThan(dwellMsFor('Hi!'));
    expect(dwellMsFor('x'.repeat(1000))).toBe(dwellMsFor('x'.repeat(2000)));
  });
});
