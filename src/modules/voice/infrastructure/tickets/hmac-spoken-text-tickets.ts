import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Clock } from '@lib/clock';
import { MS_PER_MINUTE } from '@lib/utils';

import type { SpokenTextTickets, TicketHolder } from '../../domain/ports/spoken-text-tickets.port';

/** Long enough to listen to a hint again during one homework session, short enough to go stale. */
export const SPEECH_TICKET_TTL_MS = 30 * MS_PER_MINUTE;
/** Separates this key from every other use of the same server secret. */
const KEY_LABEL = 'hort.ai/voice/speech-ticket/v1';
const VERSION = 1;

interface TicketPayload {
  readonly v: number;
  /** The text to speak. */
  readonly t: string;
  readonly ten: string;
  readonly sub: string;
  /** Expiry, epoch milliseconds. */
  readonly exp: number;
}

function isPayload(value: unknown): value is TicketPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    payload.v === VERSION &&
    typeof payload.t === 'string' &&
    typeof payload.ten === 'string' &&
    typeof payload.sub === 'string' &&
    typeof payload.exp === 'number'
  );
}

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
        payload.exp > options.clock.now().getTime();
      return current ? payload.t : null;
    },
  };
}
