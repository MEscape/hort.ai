import { generateKeyPairSync } from 'node:crypto';

/** A fresh RSA key in the PEM form of a service account's JSON key file. */
export const TEST_PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
}).privateKey.export({ type: 'pkcs8', format: 'pem' });

export interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
  /** The body as sent; every adapter here sends a string. */
  readonly body: string;
}

type Reply = Response | Error | (() => Response | Error);

/** A `fetch` that answers from a script, one reply per call, and records every call. */
export function scriptedFetch(...replies: Reply[]) {
  const calls: RecordedCall[] = [];
  const send = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      init: init ?? {},
      body: typeof init?.body === 'string' ? init.body : '',
    });
    const next = replies.shift();
    const reply = typeof next === 'function' ? next() : next;
    if (reply === undefined) {
      return Promise.reject(new Error('no scripted reply left'));
    }
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  };
  return { fetch: send, calls };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const timeoutError = () => new DOMException('The operation timed out.', 'TimeoutError');
