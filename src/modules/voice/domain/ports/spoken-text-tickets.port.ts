import type { ActorId, TenantId } from '@modules/auth';

/** Who a ticket is for: the signed-in parent it was issued to. */
export interface TicketHolder {
  readonly tenantId: TenantId;
  readonly actorId: ActorId;
}

/**
 * Tickets for text the server validated (a hint the guidance orchestrator let through). The server
 * hands a ticket to the browser next to the text; reading the text aloud takes the ticket, not the
 * text, so the browser cannot make a tutor say anything the server did not check. A ticket is
 * signed, expires, and only its holder can redeem it. Nothing is stored.
 */
export interface SpokenTextTickets {
  issue(text: string, holder: TicketHolder): string;
  /** The text the ticket was issued for, or `null` when it is forged, expired or someone else's. */
  redeem(ticket: string, holder: TicketHolder): string | null;
}
