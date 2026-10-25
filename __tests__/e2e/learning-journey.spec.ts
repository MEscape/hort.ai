import { expect, test } from '@playwright/test';

import { testClient } from './database';
import { PARENT_EMAIL, PASSWORD } from './seed';

import type { Page, Route } from '@playwright/test';

const OWN_CHILD = { id: 'e2e-child', name: 'Mia' };
const FOREIGN_CHILD = { id: 'e2e-foreign-child', name: 'NichtDeinKind' };

/** Real Better Auth sign-in through the form; lands on the signed-in child's home. */
async function signIn(page: Page, email = PARENT_EMAIL, child = OWN_CHILD) {
  await page.goto('/de/sign-in');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/de\/home$/);
  await expect(page.getByRole('heading', { name: `Hallo ${child.name}!` })).toBeAttached();
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.httpOnly && cookie.name.includes('session_token'))).toBe(
    true,
  );
  const other = child === OWN_CHILD ? FOREIGN_CHILD : OWN_CHILD;
  await expect(page.getByText(other.name)).toHaveCount(0);
}

/**
 * The current product has one active child per parent, not a profile-picker screen: the real help
 * entry selects the signed-in parent's own child and carries it to the task entry.
 */
async function openTaskEntry(page: Page, child = OWN_CHILD) {
  await page.goto('/de/help');
  await expect(page.getByRole('heading', { name: 'Gerade ist keine Aufgabe offen' })).toBeVisible();
  const entry = page.getByRole('link', { name: 'Neue Aufgabe', exact: true });
  await expect(entry).toHaveAttribute('href', new RegExp(`child=${child.id}(?:&|$)`));
  await entry.click();
}

async function signOut(page: Page) {
  await page.goto('/de/settings');
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).not.toHaveURL(/\/de\/settings/);
}

async function stored() {
  const client = testClient();
  await client.connect();
  try {
    return (
      await client.query<{ id: string; status: string; currentHintLevel: string }>(
        'SELECT id, status, "currentHintLevel" FROM "HelpSession" WHERE "childProfileId" = \'e2e-child\' ORDER BY "startedAt" DESC LIMIT 1',
      )
    ).rows[0];
  } finally {
    await client.end();
  }
}

interface Victim {
  readonly childProfileId: string;
  readonly sessionId: string;
}

interface ForgedAttempt {
  readonly status: number;
  readonly body: string;
}

function namedSessionStep(postData: string | null) {
  try {
    const parsed: unknown = JSON.parse(postData ?? '');
    const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
    if (
      typeof first === 'object' &&
      first !== null &&
      'sessionId' in first &&
      'requestId' in first
    ) {
      return first as Record<string, unknown>;
    }
  } catch {
    /* Not a help-session Server Action body. */
  }
  return undefined;
}

/**
 * Rewrites the next help-session Server Action POST this page sends (a hint request or an answer)
 * so that it names another parent's child and session, then returns what the real server answered.
 * The request still carries the signed-in parent's own cookie and the real action id.
 */
async function forgeNextAction(page: Page, kind: 'hint' | 'answer', victim: Victim) {
  let settle: (attempt: ForgedAttempt) => void = () => undefined;
  const attempt = new Promise<ForgedAttempt>((resolve) => {
    settle = resolve;
  });
  const forge = async (route: Route) => {
    const request = route.request();
    const sent =
      request.method() === 'POST' && request.headers()['next-action'] !== undefined
        ? namedSessionStep(request.postData())
        : undefined;
    if (sent === undefined || 'answer' in sent !== (kind === 'answer')) {
      await route.fallback();
      return;
    }
    await page.unroute('**/*', forge);
    const response = await route.fetch({
      postData: JSON.stringify([{ ...sent, ...victim, requestId: `e2e-forged-${kind}` }]),
    });
    settle({ status: response.status(), body: await response.text() });
    await route.fulfill({ response });
  };
  await page.route('**/*', forge);
  return attempt;
}

async function sessionRecord(sessionId: string) {
  const client = testClient();
  await client.connect();
  try {
    const { rows } = await client.query<{
      status: string;
      currentHintLevel: string;
      hints: number;
      answers: number;
      assessments: number;
      forged: number;
    }>(
      `SELECT hs.status, hs."currentHintLevel",
        (SELECT count(*)::int FROM "HintEvent" WHERE "sessionId" = hs.id) AS hints,
        (SELECT count(*)::int FROM "ChildAnswer" WHERE "sessionId" = hs.id) AS answers,
        (SELECT count(*)::int FROM "AnswerAssessment" WHERE "sessionId" = hs.id) AS assessments,
        (SELECT count(*)::int FROM "HintEvent" WHERE "idempotencyKey" LIKE '%e2e-forged%') AS forged
       FROM "HelpSession" hs WHERE hs.id = $1`,
      [sessionId],
    );
    return rows[0];
  } finally {
    await client.end();
  }
}

async function noModelSolution(page: Page) {
  const companionLines = page
    .getByRole('list', { name: 'Gespräch mit deinem Begleiter' })
    .locator('li > div');
  await expect(companionLines.first()).toBeVisible();
  for (const text of await companionLines.allTextContents()) {
    expect(text).not.toMatch(/\b(?:7|83)\b|Die Lösung ist|Richtig wäre/);
  }
}

async function complete(page: Page, answer: string, fallback = 'valid') {
  await page.getByLabel('Meine Antwort', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Gespräch mit deinem Begleiter' })).toContainText(
    /Schau dir|Noch nicht ganz/,
  );
  await expect(page.getByLabel('Meine Antwort', { exact: true })).toBeVisible();
  await noModelSolution(page);
  await page.getByLabel('Meine Antwort', { exact: true }).fill(answer);
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
  await expect(
    page.getByText(
      fallback === 'invalid' ? 'Super, das hast du selbst herausgefunden!' : 'Gut überlegt!',
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      fallback !== 'valid'
        ? 'Erklär mir in deinen eigenen Worten, wie du auf deine Antwort gekommen bist.'
        : 'Warum hast du hier addiert?',
      { exact: true },
    ),
  ).toBeVisible();
  await noModelSolution(page);
  await page.reload();
  await expect(page.getByLabel('Erzähl es mir in deinen Worten')).toBeVisible();
  await page
    .getByLabel('Erzähl es mir in deinen Worten')
    .fill('Ich habe addiert, weil etwas dazukommt.');
  await page.getByRole('button', { name: 'Antworten', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Geschafft!', exact: true })).toBeVisible();
  const session = await stored();
  expect(session?.status).toBe('COMPLETED');
  const client = testClient();
  await client.connect();
  try {
    const reply = await client.query<{ replyText: string }>(
      'SELECT "replyText" FROM "ComprehensionQuestion" WHERE "sessionId" = $1',
      [session?.id],
    );
    expect(reply.rows).toEqual([{ replyText: 'Ich habe addiert, weil etwas dazukommt.' }]);
  } finally {
    await client.end();
  }
  await noModelSolution(page);
}

test.beforeEach(async ({ page, request }) => {
  const client = testClient();
  await client.connect();
  try {
    await client.query('DELETE FROM "HelpSession" WHERE "childProfileId" = $1', ['e2e-child']);
  } finally {
    await client.end();
  }
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      await route.continue();
    } else {
      await route.abort();
      throw new Error(`Unexpected external browser request: ${url.origin}`);
    }
  });
  page.on('pageerror', (error) => {
    throw error;
  });
  await request.post(`${process.env['E2E_FAKE_URL']}/mode`, { data: 'valid' });
});

test('parent login → own task → every hint → wrong/right → re-login/resume → understanding', async ({
  page,
}) => {
  await signIn(page);
  await openTaskEntry(page);
  await page.getByRole('button', { name: 'Meine Aufgabe', exact: true }).click();
  await page
    .getByLabel('Deine Aufgabe', { exact: true })
    .fill('Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?');
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  for (const [index, level] of [
    'understand_task',
    'activate_prior_knowledge',
    'next_step',
    'similar_example',
  ].entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: 'Ich möchte einen Tipp' }).click();
    }
    await expect(
      page.getByText(`Denkanstoß ${level}: Was weißt du schon über die Aufgabe?`, { exact: true }),
    ).toBeVisible();
    await noModelSolution(page);
  }
  const before = await stored();
  expect(before?.currentHintLevel).toBe('SIMILAR_EXAMPLE');
  await page.reload();
  await expect(page.getByLabel('Meine Antwort', { exact: true })).toBeVisible();
  expect((await stored())?.id).toBe(before?.id);
  await page.getByRole('link', { name: 'Später weitermachen' }).click();
  await signOut(page);
  // A second real account: its own child is selected, and nothing of the first child's session shows.
  const victim = { childProfileId: OWN_CHILD.id, sessionId: before?.id ?? '' };
  const untouched = await sessionRecord(victim.sessionId);
  expect(untouched).toMatchObject({ hints: 4, answers: 0, assessments: 0 });
  await signIn(page, 'other@example.org', FOREIGN_CHILD);
  await openTaskEntry(page, FOREIGN_CHILD);
  await expect(page.getByText('Lisa hat 3 Äpfel und bekommt 4 dazu.')).toHaveCount(0);
  // Naming the first parent's child in the task-entry URL reveals neither the child nor its class work:
  // the loaded page (its streamed content names the requested child) carries nothing of the other family.
  const document = await page.goto(`/de/start?child=${OWN_CHILD.id}`);
  const delivered = (await document?.text()) ?? '';
  expect(delivered).toContain(OWN_CHILD.id);
  expect(delivered).not.toMatch(/Unsere Plusaufgabe|Rechne 36|e2e-assignment|\bMia\b/);
  await expect(async () => {
    await page.getByRole('button', { name: 'Schulaufgaben', exact: true }).click({ timeout: 2000 });
    await expect(
      page.getByText('Aufgaben von deiner Lehrkraft sind hier noch nicht verfügbar.', {
        exact: true,
      }),
    ).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByText('Unsere Plusaufgabe')).toHaveCount(0);
  await expect(page.getByLabel('Meine Antwort', { exact: true })).toHaveCount(0);
  // A forged Server Action from the second parent's own browser: same real endpoint and cookie, but it
  // names the first child's open session. The server must refuse it and write nothing.
  await openTaskEntry(page, FOREIGN_CHILD);
  const forgedHint = forgeNextAction(page, 'hint', victim);
  await page.getByRole('button', { name: 'Meine Aufgabe', exact: true }).click();
  await page
    .getByLabel('Deine Aufgabe', { exact: true })
    .fill('Tom hat 5 Murmeln und bekommt 6 dazu. Wie viele Murmeln hat er?');
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  const hintAttempt = await forgedHint;
  await expect(page.getByRole('button', { name: 'Nochmal versuchen', exact: true })).toBeVisible();
  const forgedAnswer = forgeNextAction(page, 'answer', victim);
  await page.getByLabel('Meine Antwort', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
  const answerAttempt = await forgedAnswer;
  for (const attempt of [hintAttempt, answerAttempt]) {
    expect(attempt.body).toMatch(/"ok":\s*false/);
    expect(attempt.body).not.toMatch(/"ok":\s*true|Lisa hat 3 Äpfel|Denkanstoß/);
  }
  expect(await sessionRecord(victim.sessionId)).toEqual({ ...untouched, forged: 0 });
  await signOut(page);
  await signIn(page);
  await page.getByRole('link', { name: /^Weiter:/ }).click();
  await expect(page.getByLabel('Meine Antwort', { exact: true })).toBeVisible();
  expect((await stored())?.id).toBe(before?.id);
  await complete(page, '7');
});

for (const mode of ['valid', 'invalid', 'leaking']) {
  test(`teacher assignment stays server-side; ${mode} AI; safe fallback and completion`, async ({
    page,
    request,
  }) => {
    await signIn(page);
    await request.post(`${process.env['E2E_FAKE_URL']}/mode`, { data: mode });
    const wire: Array<Promise<string>> = [];
    page.on('response', (response) => {
      if (
        response.url().startsWith(process.env['E2E_BASE_URL'] ?? '') &&
        /text\/(?:html|x-component)|application\/json/.test(
          response.headers()['content-type'] ?? '',
        )
      ) {
        // Canceled prefetches contain no delivered response; complete bodies are awaited below.
        wire.push(response.text().catch(() => ''));
      }
    });
    await openTaskEntry(page);
    await page.getByRole('button', { name: 'Schulaufgaben', exact: true }).click();
    await page.getByRole('button', { name: /Unsere Plusaufgabe/ }).click();
    await expect(page.getByText('Rechne 36 + 47', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Mit dieser Aufgabe anfangen' }).click();
    for (const index of [0, 1, 2, 3]) {
      if (index > 0) {
        await page.getByRole('button', { name: 'Ich möchte einen Tipp' }).click();
      }
      await expect
        .poll(async () => (await stored())?.currentHintLevel)
        .toBe(
          ['UNDERSTAND_TASK', 'ACTIVATE_PRIOR_KNOWLEDGE', 'NEXT_STEP', 'SIMILAR_EXAMPLE'][index],
        );
      await expect(
        page.getByRole('list', { name: 'Gespräch mit deinem Begleiter' }).locator('li > div'),
      ).toHaveCount(index + 1);
      await noModelSolution(page);
    }
    // Check the exact server-side key is absent from streamed HTML/RSC/action responses before the child submits it.
    expect(wire.length).toBeGreaterThan(0);
    const received = (await Promise.all(wire)).join('\n');
    expect(received).toContain('Rechne 36 + 47');
    expect(received).not.toMatch(/solutionKey|"83"|Die Lösung ist 83/);
    const requests = await (await request.get(`${process.env['E2E_FAKE_URL']}/requests`)).text();
    expect(requests).not.toContain('solutionKey');
    if (mode !== 'valid') {
      const client = testClient();
      await client.connect();
      try {
        const hints = await client.query<{ fallbackReason: string; text: null }>(
          'SELECT "fallbackReason", text FROM "HintEvent" WHERE "sessionId" = $1',
          [(await stored())?.id],
        );
        expect(hints.rows).toHaveLength(4);
        expect(
          hints.rows.every(
            (hint) =>
              hint.text === null &&
              hint.fallbackReason === (mode === 'invalid' ? 'invalid_output' : 'solution_leaked'),
          ),
        ).toBe(true);
      } finally {
        await client.end();
      }
    }
    // Key-backed assessment still works with invalid/leaking provider wording.
    // In leaking mode praise is deliberately safe, while the comprehension question leaks and must fall back.
    await complete(page, '83', mode);
  });
}
