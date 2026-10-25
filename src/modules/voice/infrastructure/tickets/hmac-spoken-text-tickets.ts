import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Clock } from '@lib/clock';
import { isFiniteNumber, isString, MS_PER_MINUTE, objectOf } from '@lib/utils';

import type { SpokenTextTickets, TicketHolder } from '../../domain/ports/spoken-text-tickets.port';

const TICKET_TTL_MINUTES = 30;
/** Long enough to listen to a hint again during one homework session, short enough to go stale. */
const SPEECH_TICKET_TTL_MS = TICKET_TTL_MINUTES * MS_PER_MINUTE;
/** Separates this key from every other use of the same server secret. */
const KEY_LABEL = 'hort.ai/voice/speech-ticket/v1';
const VERSION = 1;

interface TicketPayload {
  readonly v: number;
  /** The text to speak. */
  readonly t: string;
  readonly ten: string;
  readonly sub: string;
  readonly child?: string;
  readonly speaker?: string;
  /** Expiry, epoch milliseconds. */
  readonly exp: number;
}

const isPayload = objectOf<TicketPayload>({
  v: (value): value is number => value === VERSION,
  t: isString,
  ten: isString,
  sub: isString,
  child: (value): value is string | undefined => value === undefined || typeof value === 'string',
  speaker: (value): value is string | undefined => value === undefined || typeof value === 'string',
  exp: isFiniteNumber,
});

function decode(part: string): unknown {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Stateless tickets: `base64url(payload).base64url(HMAC-SHA256(payload))`. The payload names the
 * text, the parent it was issued to and when it expires; the key is derived from a server secret
 * that never leaves the server. Nothing is stored, so no schema or table is needed and a ticket
 * stays valid across server instances that share the secret.
 */
export function hmacSpokenTextTickets(options: {
  readonly secret: string;
  readonly clock: Clock;
  readonly ttlMs?: number;
}): SpokenTextTickets {
  const key = createHmac('sha256', options.secret).update(KEY_LABEL).digest();
  const ttlMs = options.ttlMs ?? SPEECH_TICKET_TTL_MS;
  const sign = (body: string) => createHmac('sha256', key).update(body).digest();

  return {
    issue(text: string, holder: TicketHolder): string {
      const payload: TicketPayload = {
        v: VERSION,
        t: text,
        ten: holder.tenantId,
        sub: holder.actorId,
        ...(holder.childProfileId === undefined ? {} : { child: holder.childProfileId }),
        ...(holder.speakerId === undefined ? {} : { speaker: holder.speakerId }),
        exp: options.clock.now().getTime() + ttlMs,
      };
      const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
      return `${body}.${sign(body).toString('base64url')}`;
    },

    redeem(ticket: string, holder: TicketHolder): string | null {
      const [body, signature, ...rest] = ticket.split('.');
      if (body === undefined || signature === undefined || rest.length > 0) {
        return null;
      }
      const expected = sign(body);
      const given = Buffer.from(signature, 'base64url');
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        return null;
      }
      const payload = decode(body);
      if (!isPayload(payload)) {
        return null;
      }
      const current =
        payload.ten === holder.tenantId &&
        payload.sub === holder.actorId &&
        (payload.child === undefined || payload.child === holder.childProfileId) &&
        (payload.speaker === undefined || payload.speaker === holder.speakerId) &&
        payload.exp > options.clock.now().getTime();
      return current ? payload.t : null;
    },
  };
}
