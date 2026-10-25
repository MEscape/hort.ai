import { describe, expect, it, vi } from 'vitest';

import type {
  ChildCompanion,
  ChildHome,
  ChildTasks,
  FeedResult,
  LevelStatus,
} from '@modules/alexa/application/contracts/child-companion-model';
import type { TutorVoice } from '@modules/alexa/application/contracts/tutor-voice-model';
import { toTutorId } from '@modules/alexa/domain/models/ids';
import { connectionTestTutor } from '@modules/alexa/infrastructure/connection-test/connection-test-tutor';
import { catalogTutorIntroductions } from '@modules/alexa/infrastructure/tutors/catalog-tutor-introductions';
import { createAlexaEndpoint } from '@modules/alexa/presentation/routes';
import {
  CHILD_LINES,
  LEVEL_UP_LINES,
  STARS_GAINED_LINES,
} from '@modules/alexa/presentation/speech/child-lines';
import channelLines from '@modules/voice/infrastructure/catalog/channel-lines.json';

import { infrastructureError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { ResultAsync, errAsync, ok, okAsync } from '@lib/result';

const SKILL_ID = 'amzn1.ask.skill.00000000-0000-0000-0000-000000000000';
const CLIP = 'https://clips.example/speech-clips/clip.mp3?sig=x';
const introductions = catalogTutorIntroductions();
const LILI_GREETING = introductions.find((intro) => intro.tutorId === 'lili')?.text ?? '';
const MAX_GREETING = introductions.find((intro) => intro.tutorId === 'max')?.text ?? '';
/** Sentences as a listener hears them: each ends with . ! or ?. */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter((part) => part.length > 0);

const HOME: ChildHome = {
  tutorId: toTutorId('lili'),
  learningAllowed: true,
  rewardAvailable: true,
  mood: 'cheerful',
  openTasks: 0,
};

interface FakeState {
  home?: AppResultAsync<ChildHome>;
  feed?: AppResultAsync<FeedResult>;
  level?: AppResultAsync<LevelStatus>;
  tasks?: AppResultAsync<ChildTasks>;
  companion?: ChildHome['tutorId'];
  /** Every use case hangs (a database that never answers). */
  hang?: boolean;
}

/** A use-case call that never settles. */
const hanging = <T>(): AppResultAsync<T> => new ResultAsync(new Promise(() => undefined));

/** The bound child's use cases as fakes; `calls` records which operations a turn used. */
function fakeChild(state: FakeState = {}) {
  const calls: string[] = [];
  const hang = state.hang === true;
  /** The voice lookups (`companion()`), apart from the operations in `calls`. */
  const lookups: string[] = [];
  const companion: ChildCompanion = {
    companion: () => (
      lookups.push('companion'),
      hang
        ? hanging()
        : okAsync(state.companion === undefined ? toTutorId('lili') : state.companion)
    ),
    home: () => (calls.push('home'), hang ? hanging() : (state.home ?? okAsync(HOME))),
    feed: () => (
      calls.push('feed'),
      hang
        ? hanging()
        : (state.feed ?? okAsync({ outcome: 'granted', stars: 1, leveledUp: false, level: 1 }))
    ),
    level: () => (
      calls.push('level'),
      hang ? hanging() : (state.level ?? okAsync({ level: 3, starsToNext: 2 }))
    ),
    tasks: () => (
      calls.push('tasks'),
      hang ? hanging() : (state.tasks ?? okAsync({ inClass: true, titles: [] }))
    ),
  };
  return { companion, calls, lookups };
}

function endpoint(state: FakeState = {}, voice: TutorVoice | null = null) {
  const child = fakeChild(state);
  const handle = createAlexaEndpoint({
    skillId: SKILL_ID,
    verify: () => okAsync(undefined),
    tutor: connectionTestTutor,
    introductions,
    voice,
    voiceDeadlineMs: 50,
    child: {
      companion: child.companion,
      defaultTutorId: toTutorId('max'),
      backendDeadlineMs: 100,
    },
  });
  return { handle, calls: child.calls, lookups: child.lookups };
}

interface Turn {
  intent?: string;
  utterance?: string;
  attributes?: Record<string, unknown>;
}

function request(type: 'LaunchRequest' | 'IntentRequest', turn: Turn = {}) {
  return new Request('https://hort.example/api/alexa', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: '1.0',
      context: { System: { application: { applicationId: SKILL_ID } } },
      session: {
        sessionId: 'amzn1.echo-api.session.child',
        application: { applicationId: SKILL_ID },
        ...(turn.attributes ? { attributes: turn.attributes } : {}),
      },
      request: {
        type,
        requestId: 'amzn1.echo-api.request.child',
        timestamp: new Date().toISOString(),
        locale: 'de-DE',
        ...(turn.intent
          ? {
              intent: {
                name: turn.intent,
                ...(turn.utterance === undefined
                  ? {}
                  : { slots: { eingabe: { name: 'eingabe', value: turn.utterance } } }),
              },
            }
          : {}),
      },
    }),
  });
}

interface AlexaBody {
  sessionAttributes?: { question?: unknown; last?: unknown; speaker?: unknown };
  response: {
    outputSpeech?: { text: string };
    reprompt?: { outputSpeech: { text: string } };
    shouldEndSession: boolean;
    directives?: Array<{
      document: { mainTemplate: { item: { items: Array<Record<string, string>> } } };
    }>;
  };
}

async function said(response: Response) {
  const body = (await response.json()) as AlexaBody;
  return {
    body,
    text: body.response.outputSpeech?.text ?? '',
    open: !body.response.shouldEndSession,
    reprompt: body.response.reprompt?.outputSpeech.text,
  };
}

const launch = (state?: FakeState) => endpoint(state).handle(request('LaunchRequest'));
const intent = (name: string, state?: FakeState, turn: Omit<Turn, 'intent'> = {}) =>
  endpoint(state).handle(request('IntentRequest', { intent: name, ...turn }));

describe('Alexa child channel: launch', () => {
  it('greets with a short hello of the own companion, offers the snack and keeps listening', async () => {
    const { text, open, body } = await said(await launch());

    expect(text).toBe(`${CHILD_LINES.hello} ${CHILD_LINES.snack}`);
    expect(text).not.toContain(MAX_GREETING);
    expect(text).not.toContain(LILI_GREETING);
    expect(open).toBe(true);
    expect(body.sessionAttributes?.question).toBe('feed');
    expect(body.sessionAttributes?.speaker).toBe('lili');
  });

  it('says at most three sentences with the real catalog, teacher tasks and the snack', async () => {
    for (const home of [
      { ...HOME, openTasks: 3, mood: 'sleepy' as const },
      { ...HOME, openTasks: 1, mood: 'bored' as const },
      { ...HOME, openTasks: 2, rewardAvailable: false },
    ]) {
      const { text } = await said(await launch({ home: okAsync(home) }));

      expect(sentences(text).length).toBeLessThanOrEqual(3);
    }
  });

  it('says the learning-pause sentence outside the learning window and ends', async () => {
    const { text, open } = await said(
      await launch({ home: okAsync({ ...HOME, learningAllowed: false }) }),
    );

    expect(text).toBe(CHILD_LINES.learningPause);
    expect(open).toBe(false);
  });

  it('asks what to do instead of offering a snack when the reward is claimed', async () => {
    const { text, open, body } = await said(
      await launch({ home: okAsync({ ...HOME, rewardAvailable: false }) }),
    );

    expect(text).toBe(`${CHILD_LINES.hello} ${CHILD_LINES.whatNow}`);
    expect(open).toBe(true);
    expect(body.sessionAttributes?.question).toBeNull();
  });

  it('mentions open teacher tasks (one, several) and none without tasks', async () => {
    const one = await said(await launch({ home: okAsync({ ...HOME, openTasks: 1 }) }));
    const many = await said(await launch({ home: okAsync({ ...HOME, openTasks: 3 }) }));
    const none = await said(await launch());

    expect(one.text).toBe(`${CHILD_LINES.hello} ${CHILD_LINES.teacherTask} ${CHILD_LINES.snack}`);
    expect(many.text).toContain(CHILD_LINES.teacherTasks);
    expect(none.text).not.toContain('Lehrerin');
  });

  it('shows the mood in the snack offer', async () => {
    const bored = await said(await launch({ home: okAsync({ ...HOME, mood: 'bored' }) }));
    const sleepy = await said(await launch({ home: okAsync({ ...HOME, mood: 'sleepy' }) }));

    expect(bored.text).toContain(CHILD_LINES.snackHungry);
    expect(sleepy.text).toContain(CHILD_LINES.snackSleepy);
  });

  it('speaks as the default companion when the child has none', async () => {
    const { body } = await said(
      await launch({ companion: null, home: okAsync({ ...HOME, tutorId: null }) }),
    );

    expect(body.sessionAttributes?.speaker).toBe('max');
  });

  it('answers a failed backend with a calm sentence, never an error', async () => {
    const { text, open } = await said(
      await launch({ home: errAsync(infrastructureError('db.down', 'Database down.')) }),
    );

    expect(text).toBe(CHILD_LINES.unavailable);
    expect(open).toBe(false);
  });
});

describe('Alexa child channel: feeding, level and teacher tasks', () => {
  it('feeds on "füttern": thanks and the stars, with correct number', async () => {
    const one = await said(await intent('FuetternIntent'));
    const five = await said(
      await intent('FuetternIntent', {
        feed: okAsync({ outcome: 'granted', stars: 5, leveledUp: false, level: 2 }),
      }),
    );
    const odd = await said(
      await intent('FuetternIntent', {
        feed: okAsync({ outcome: 'granted', stars: 7, leveledUp: false, level: 2 }),
      }),
    );

    expect(one.text).toBe(`${CHILD_LINES.fed} ${STARS_GAINED_LINES[1]} ${CHILD_LINES.whatNow}`);
    expect(five.text).toContain('Du hast fünf Sterne bekommen.');
    expect(odd.text).toContain('Du hast 7 Sterne bekommen.');
  });

  it('cheers a level-up', async () => {
    const { text } = await said(
      await intent('FuetternIntent', {
        feed: okAsync({ outcome: 'granted', stars: 5, leveledUp: true, level: 3 }),
      }),
    );

    expect(text).toContain(LEVEL_UP_LINES[3]);
  });

  it('says it is full when the reward was already claimed, and stays calm on failure', async () => {
    const full = await said(
      await intent('FuetternIntent', {
        feed: okAsync({ outcome: 'already_claimed', stars: 5, leveledUp: false, level: 2 }),
      }),
    );
    const failed = await said(
      await intent('FuetternIntent', { feed: errAsync(infrastructureError('db.down', 'Down.')) }),
    );

    expect(full.text).toBe(`${CHILD_LINES.full} ${CHILD_LINES.whatNow}`);
    expect(failed.text).toBe(`${CHILD_LINES.feedFailed} ${CHILD_LINES.whatNow}`);
    expect(failed.open).toBe(true);
  });

  it('tells the level and the stars to the next one, and the top level without pressure', async () => {
    const level = await said(await intent('LevelIntent'));
    const oneStar = await said(
      await intent('LevelIntent', { level: okAsync({ level: 4, starsToNext: 1 }) }),
    );
    const top = await said(
      await intent('LevelIntent', { level: okAsync({ level: 6, starsToNext: null }) }),
    );

    expect(level.text).toBe(
      `Du bist auf Level 3. Noch 2 Sterne bis Level 4. ${CHILD_LINES.whatNow}`,
    );
    expect(oneStar.text).toContain('Noch einen Stern bis Level 5.');
    expect(top.text).toBe(`${CHILD_LINES.maxLevel} ${CHILD_LINES.whatNow}`);
  });

  it('reads at most three teacher titles, then the honest phase-2 placeholder', async () => {
    const { text } = await said(
      await intent('SchulaufgabenIntent', {
        tasks: okAsync({
          inClass: true,
          titles: ['Murmeln', 'Äpfel teilen.', 'Uhrzeit', 'Vierte'],
        }),
      }),
    );

    expect(text).toBe(
      `${CHILD_LINES.tasksIntro} Erstens, Murmeln. Zweitens, Äpfel teilen. Drittens, Uhrzeit. ${CHILD_LINES.soon} ${CHILD_LINES.whatNow}`,
    );
    expect(text).not.toContain('Vierte');
  });

  it('has a friendly sentence for no tasks and for no class', async () => {
    const none = await said(await intent('SchulaufgabenIntent'));
    const noClass = await said(
      await intent('SchulaufgabenIntent', { tasks: okAsync({ inClass: false, titles: [] }) }),
    );

    expect(none.text).toBe(`${CHILD_LINES.noTasks} ${CHILD_LINES.whatNow}`);
    expect(noClass.text).toBe(`${CHILD_LINES.noClass} ${CHILD_LINES.whatNow}`);
  });

  it('answers the phase-2 intents with the placeholder and starts nothing', async () => {
    for (const name of ['AufgabeIntent', 'TippIntent', 'AntwortIntent', 'AuswahlIntent']) {
      const { handle, calls } = endpoint();
      const { text, open } = await said(await handle(request('IntentRequest', { intent: name })));

      expect(text).toBe(`${CHILD_LINES.soon} ${CHILD_LINES.whatNow}`);
      expect(open).toBe(true);
      expect(calls).toEqual([]);
    }
  });
});

describe('Alexa child channel: yes/no, help, repeat, stop and not understood', () => {
  const snackAsked = { question: 'feed', last: [{ kind: 'line', text: CHILD_LINES.snack }] };

  it('feeds on "ja" to the snack offer, and declines on "nein"', async () => {
    const { handle, calls } = endpoint();
    const yes = await said(
      await handle(
        request('IntentRequest', { intent: 'AMAZON.YesIntent', attributes: snackAsked }),
      ),
    );
    const no = await said(await intent('AMAZON.NoIntent', {}, { attributes: snackAsked }));

    expect(calls).toEqual(['feed']);
    expect(yes.text.startsWith(CHILD_LINES.fed)).toBe(true);
    expect(no.text).toBe(`${CHILD_LINES.laterThen} ${CHILD_LINES.whatNow}`);
    expect(no.open).toBe(true);
  });

  it('does not feed on "ja" without an open question', async () => {
    const { handle, calls } = endpoint();
    const { text } = await said(
      await handle(request('IntentRequest', { intent: 'AMAZON.YesIntent' })),
    );

    expect(calls).toEqual([]);
    expect(text).toBe(`${CHILD_LINES.options} ${CHILD_LINES.whatNow}`);
  });

  it('gives context help: about the snack question, else the options', async () => {
    const feedHelp = await said(await intent('AMAZON.HelpIntent', {}, { attributes: snackAsked }));
    const plain = await said(await intent('AMAZON.HelpIntent'));

    expect(feedHelp.text).toBe(CHILD_LINES.helpFeed);
    expect(feedHelp.body.sessionAttributes?.question).toBe('feed');
    expect(plain.text).toBe(`${CHILD_LINES.options} ${CHILD_LINES.whatNow}`);
  });

  it('repeats the last reply and keeps the open question', async () => {
    const last = [
      { kind: 'alexa', text: 'Du bist auf Level 3. Noch 2 Sterne bis Level 4.' },
      { kind: 'line', text: CHILD_LINES.whatNow },
    ];
    const { text, body } = await said(
      await intent('AMAZON.RepeatIntent', {}, { attributes: { question: null, last } }),
    );

    expect(text).toBe(`Du bist auf Level 3. Noch 2 Sterne bis Level 4. ${CHILD_LINES.whatNow}`);
    expect(body.sessionAttributes?.last).toEqual(last);
  });

  it('ends on stop, cancel and "tschüss", always', async () => {
    for (const turn of [
      { intent: 'AMAZON.StopIntent' },
      { intent: 'AMAZON.CancelIntent' },
      { intent: 'FreieEingabeIntent', utterance: 'nein tschüss', attributes: snackAsked },
    ]) {
      const { text, open, body } = await said(
        await endpoint().handle(request('IntentRequest', turn)),
      );

      expect(text).toBe(CHILD_LINES.bye);
      expect(open).toBe(false);
      expect(body.sessionAttributes).toBeUndefined();
    }
  });

  it('asks again on the first miss and names the options on the second', async () => {
    const first = await said(await intent('AMAZON.FallbackIntent'));
    const second = await said(
      await intent('AMAZON.FallbackIntent', {}, { attributes: first.body.sessionAttributes ?? {} }),
    );

    expect(first.text).toBe(CHILD_LINES.notUnderstood);
    expect(first.open).toBe(true);
    expect(second.text).toBe(`${CHILD_LINES.options} ${CHILD_LINES.whatNow}`);
  });

  it('re-prompts with the closing question only', async () => {
    const { reprompt } = await said(await intent('LevelIntent'));

    expect(reprompt).toBe(CHILD_LINES.whatNow);
  });

  it('keeps only surface state in the session attributes', async () => {
    const { body } = await said(await launch());

    expect(Object.keys(body.sessionAttributes ?? {}).sort()).toEqual([
      'last',
      'question',
      'speaker',
    ]);
  });
});

describe('Alexa child channel: the first interaction model (FreieEingabeIntent only)', () => {
  it.each([
    ['füttern', 'feed'],
    ['gib ihm was zu essen', 'feed'],
    ['welches level habe ich', 'level'],
    ['was habe ich auf', 'tasks'],
  ])('maps "%s" onto %s', async (utterance, operation) => {
    const { handle, calls } = endpoint();

    await handle(request('IntentRequest', { intent: 'FreieEingabeIntent', utterance }));

    expect(calls).toEqual([operation]);
  });

  it('maps "ja" onto the open snack question and unknown words onto not understood', async () => {
    const { handle, calls } = endpoint();
    await handle(
      request('IntentRequest', {
        intent: 'FreieEingabeIntent',
        utterance: 'ja',
        attributes: { question: 'feed', last: [] },
      }),
    );
    const unknown = await said(
      await intent('FreieEingabeIntent', {}, { utterance: 'warum ist der himmel blau' }),
    );

    expect(calls).toEqual(['feed']);
    expect(unknown.text).toBe(CHILD_LINES.notUnderstood);
  });
});

describe('Alexa child channel: only the free input is mapped by keywords', () => {
  it('does not feed on an unknown intent whose slot says "füttern"', async () => {
    for (const name of ['UnbekannterIntent', 'AMAZON.FallbackIntent']) {
      const { handle, calls } = endpoint();

      const { text } = await said(
        await handle(request('IntentRequest', { intent: name, utterance: 'füttern' })),
      );

      expect(calls).toEqual([]);
      expect(text).toBe(CHILD_LINES.notUnderstood);
    }
  });
});

describe('Alexa child channel: a hanging database', () => {
  it('ends on stop at once, without asking the database', async () => {
    for (const turn of [
      { intent: 'AMAZON.StopIntent' },
      { intent: 'FreieEingabeIntent', utterance: 'tschüss' },
    ]) {
      const { handle, calls, lookups } = endpoint({ hang: true });
      const started = performance.now();

      const { text, open } = await said(await handle(request('IntentRequest', turn)));

      expect(text).toBe(CHILD_LINES.bye);
      expect(open).toBe(false);
      expect(calls).toEqual([]);
      expect(lookups).toEqual([]);
      expect(performance.now() - started).toBeLessThan(1_000);
    }
  });

  it('answers help and repeat without the database, in the voice of the last reply', async () => {
    const lineUrl = vi.fn((_tutorId: string, _text: string) => okAsync(CLIP));
    const voice: TutorVoice = {
      audioUrl: () => okAsync(CLIP),
      lineUrl,
      greetingUrl: () => okAsync(CLIP),
    };
    const { handle, lookups } = endpoint({ hang: true }, voice);
    const last = [{ kind: 'line', text: CHILD_LINES.whatNow }];

    const help = await said(
      await handle(request('IntentRequest', { intent: 'AMAZON.HelpIntent' })),
    );
    const repeat = await said(
      await handle(
        request('IntentRequest', {
          intent: 'AMAZON.RepeatIntent',
          attributes: { question: null, last, speaker: 'lili' },
        }),
      ),
    );

    expect(help.open && repeat.open).toBe(true);
    expect(lookups).toEqual([]);
    expect(lineUrl.mock.calls.at(-1)?.[0]).toBe('lili');
  });

  it('answers launch and feeding calmly within the deadline when the use cases hang', async () => {
    const { handle } = endpoint({ hang: true });
    const started = performance.now();

    const launched = await said(await handle(request('LaunchRequest')));
    const fed = await said(await handle(request('IntentRequest', { intent: 'FuetternIntent' })));

    expect(launched.text).toBe(CHILD_LINES.unavailable);
    expect(launched.open).toBe(false);
    expect(fed.text).toBe(`${CHILD_LINES.notNow} ${CHILD_LINES.whatNow}`);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('ignores a speaker in the attributes that is no ready tutor', async () => {
    const { body } = await said(
      await intent('AMAZON.HelpIntent', {}, { attributes: { speaker: 'nemo' } }),
    );

    expect(body.sessionAttributes?.speaker).toBe('max');
  });
});

describe('Alexa child channel: voices', () => {
  function recordingVoice(fail = false) {
    const lineUrl = vi.fn((_tutorId: string, _text: string) =>
      fail ? errAsync(infrastructureError('voice.disabled', 'Off.')) : okAsync(CLIP),
    );
    const greetingUrl = vi.fn((_tutorId: string) => okAsync(CLIP));
    const voice: TutorVoice = { audioUrl: () => okAsync(CLIP), lineUrl, greetingUrl };
    return { voice, lineUrl, greetingUrl };
  }

  it('speaks the fixed lines in the own companion voice, numbers in Alexa voice', async () => {
    const { voice, lineUrl, greetingUrl } = recordingVoice();
    const { handle } = endpoint({}, voice);

    const launched = await said(await handle(request('LaunchRequest')));
    const level = await said(await handle(request('IntentRequest', { intent: 'LevelIntent' })));

    expect(greetingUrl).not.toHaveBeenCalled();
    expect(lineUrl).toHaveBeenCalledWith('lili', CHILD_LINES.hello);
    expect(lineUrl.mock.calls.every(([tutorId]) => tutorId === 'lili')).toBe(true);
    expect(launched.body.response.directives?.[0]?.document.mainTemplate.item.items).toEqual([
      { type: 'Audio', source: CLIP },
      { type: 'Audio', source: CLIP },
    ]);
    expect(level.body.response.directives?.[0]?.document.mainTemplate.item.items).toEqual([
      { type: 'Speech', content: 'Du bist auf Level 3. Noch 2 Sterne bis Level 4.' },
      { type: 'Audio', source: CLIP },
    ]);
  });

  it('falls back to plain text in Alexa voice when no clip is available', async () => {
    const { voice } = recordingVoice(true);
    const { handle } = endpoint({ home: okAsync({ ...HOME, learningAllowed: false }) }, voice);

    const { text, body } = await said(await handle(request('LaunchRequest')));

    expect(text).toBe(CHILD_LINES.learningPause);
    expect(body.response.directives).toBeUndefined();
  });

  it('lists every fixed child line in the reviewed channel lines of the voice module', () => {
    const reviewed = new Set(Object.values(channelLines));
    const fixed = [
      ...Object.values(CHILD_LINES),
      ...Object.values(STARS_GAINED_LINES),
      ...Object.values(LEVEL_UP_LINES),
    ];

    expect(fixed.filter((line) => !reviewed.has(line))).toEqual([]);
  });
});

describe('Alexa child channel: latency of the channel itself', () => {
  it('answers a launch with instant use cases well under a second', async () => {
    const { handle } = endpoint();
    const started = performance.now();

    for (let run = 0; run < 20; run += 1) {
      await handle(request('LaunchRequest'));
    }

    expect((performance.now() - started) / 20).toBeLessThan(100);
  });
});

describe('Alexa child channel: the whole request stays within its budget', () => {
  /** Slow verification, hanging use cases and hanging clips at once, with the production deadlines. */
  function worstCase(budgetMs: number, verifyMs: number) {
    const child = fakeChild({ hang: true });
    const hangingClip = () => hanging<string>();
    const handle = createAlexaEndpoint({
      skillId: SKILL_ID,
      verify: () =>
        new ResultAsync(
          new Promise((resolve) => {
            setTimeout(() => resolve(ok(undefined)), verifyMs);
          }),
        ),
      tutor: connectionTestTutor,
      introductions,
      voice: { audioUrl: hangingClip, lineUrl: hangingClip, greetingUrl: hangingClip },
      child: { companion: child.companion, defaultTutorId: toTutorId('max') },
      requestBudgetMs: budgetMs,
    });
    return handle;
  }

  it('answers launch calmly before the deadline counted from arrival, verification included', async () => {
    const handle = worstCase(1_500, 400);
    const started = performance.now();

    const { text, open } = await said(await handle(request('LaunchRequest')));

    const elapsed = performance.now() - started;
    expect(text).toBe(CHILD_LINES.unavailable);
    expect(open).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(1_500);
  });

  it('ends on stop before the deadline with hanging clips and slow verification', async () => {
    const handle = worstCase(1_500, 400);
    const started = performance.now();

    const { text } = await said(
      await handle(request('IntentRequest', { intent: 'AMAZON.StopIntent' })),
    );

    expect(text).toBe(CHILD_LINES.bye);
    expect(performance.now() - started).toBeLessThan(1_500);
  });

  it('fails closed without a skill answer when verification outlasts the deadline', async () => {
    const child = fakeChild();
    const handle = createAlexaEndpoint({
      skillId: SKILL_ID,
      verify: () => hanging<void>(),
      tutor: connectionTestTutor,
      introductions,
      child: { companion: child.companion, defaultTutorId: toTutorId('max') },
      requestBudgetMs: 300,
    });
    const started = performance.now();

    const response = await handle(request('LaunchRequest'));

    expect(performance.now() - started).toBeLessThan(1_000);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'request_timeout' } });
    expect([...child.calls, ...child.lookups]).toEqual([]);
  });

  it('fails closed before verifying when the body arrives too slowly', async () => {
    const verify = vi.fn(() => okAsync(undefined));
    const handle = createAlexaEndpoint({
      skillId: SKILL_ID,
      verify,
      tutor: connectionTestTutor,
      child: { companion: fakeChild().companion, defaultTutorId: toTutorId('max') },
      requestBudgetMs: 300,
    });
    const slowBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"version":'));
      },
    });
    const started = performance.now();

    const response = await handle(
      new Request('https://hort.example/api/alexa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: slowBody,
        duplex: 'half',
      } as RequestInit),
    );

    expect(performance.now() - started).toBeLessThan(1_000);
    expect(response.status).toBe(503);
    expect(verify).not.toHaveBeenCalled();
  });
});
