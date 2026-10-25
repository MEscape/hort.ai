import { createServer } from 'node:http';

import type { IncomingMessage, ServerResponse } from 'node:http';

type GeminiPayload = {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ parts: Array<{ text: string }> }>;
};

const VALID_TEXT: Record<string, string> = {
  praise: 'Gut überlegt!',
  comprehension_question: 'Warum hast du hier addiert?',
  answer_assessment: 'Schau dir noch einmal an, was dazukommt.',
};

function wording(mode: string, kind: string, hintLevel: string) {
  if (mode === 'leaking' && kind !== 'praise') {
    return kind === 'hint' ? 'Die Lösung ist 83.' : 'Schreib: 83. Warum ist das so?';
  }
  if (kind === 'hint') {
    return `Denkanstoß ${hintLevel}: Was weißt du schon über die Aufgabe?`;
  }
  return VALID_TEXT[kind] ?? '';
}

/** The JSON a Gemini `generateContent` call would carry for this run's provider mode. */
function geminiOutput(mode: string, payload: GeminiPayload) {
  if (mode === 'invalid') {
    return { unexpected: true };
  }
  const instructions = payload.systemInstruction.parts[0]?.text ?? '';
  const data = JSON.parse(payload.contents[0]?.parts[0]?.text ?? '{}') as { answer?: string };
  const kind = /"kind": "([a-z_]+)"/.exec(instructions)?.[1] ?? 'hint';
  const hintLevel = /"hintLevel": "([a-z_]+)"/.exec(instructions)?.[1] ?? 'understand_task';
  return {
    version: 1,
    kind,
    hintLevel,
    text: wording(mode, kind, hintLevel),
    ...(kind === 'answer_assessment'
      ? { result: data.answer === '7' ? 'correct' : 'not_yet' }
      : {}),
  };
}

async function readBody(request: IncomingMessage) {
  let body = '';
  for await (const chunk of request) {
    body += String(chunk);
  }
  return body;
}

/** HTTP fakes of external services; the real Gemini/Upstash adapters remain in the app. */
export async function fakeServices() {
  let mode = 'valid';
  const requests: unknown[] = [];
  const counters = new Map<string, { hits: number; until: number }>();

  function rateLimit(body: string) {
    const command = JSON.parse(body) as [string, string, number, string, number];
    const key = command[3];
    const now = Date.now();
    const current = counters.get(key);
    const bucket =
      current === undefined || current.until <= now
        ? { hits: 0, until: now + command[4] * 1000 }
        : current;
    bucket.hits += 1;
    counters.set(key, bucket);
    return { result: [bucket.hits, bucket.until - now] };
  }

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const body = await readBody(request);
    response.setHeader('content-type', 'application/json');
    if (request.url === '/mode') {
      mode = body;
      response.end('{}');
    } else if (request.url === '/requests') {
      response.end(JSON.stringify(requests));
    } else if (request.url === '/redis') {
      response.end(JSON.stringify(rateLimit(body)));
    } else if (request.url?.startsWith('/v1beta/models/') === true) {
      const payload = JSON.parse(body) as GeminiPayload;
      requests.push(payload);
      const text = JSON.stringify(geminiOutput(mode, payload));
      response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
    } else {
      response.statusCode = 404;
      response.end('{}');
    }
  }

  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: String(error) }));
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No fake-service port');
  }
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}
