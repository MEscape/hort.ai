import type { CompanionMessageRef, PredefinedWording } from '../../domain/models/companion-message';
import type { SystemPhrase } from '../../domain/models/system-phrase';

/**
 * What a speaker should say. There is deliberately no way to pass words: a request names a fixed
 * line of the tutor catalog, or redeems a ticket the server issued for a validated hint.
 */
export type SpeechSource =
  | { readonly kind: 'phrase'; readonly phrase: SystemPhrase }
  | { readonly kind: 'ticket'; readonly ticket: string };

/** `speakerId` is a tutor id from the catalog or the narrator's. */
export interface SynthesizeSpeechInput {
  readonly speakerId: string;
  readonly source: SpeechSource;
  /** Required to redeem a companion-message ticket; checked against current parental consent. */
  readonly childProfileId?: string;
}

/**
 * What hosted speech (a clip behind a URL, for channels without a signed-in actor) should say: a
 * fixed line of the tutor catalog, or a fixed channel sentence that must match `channel-lines.json`
 * exactly; any other text is refused. Validated hints need a ticket and therefore an actor, so they
 * are not speakable here.
 */
export type HostedSpeechSource =
  | { readonly kind: 'phrase'; readonly phrase: SystemPhrase }
  | { readonly kind: 'channel-line'; readonly text: string };

export interface HostedSpeechInput {
  readonly speakerId: string;
  readonly source: HostedSpeechSource;
}

/** A child's recording, held in memory for the one request, and which child is speaking. */
export interface TranscribeSpeechInput {
  readonly childProfileId: string;
  readonly audio: Uint8Array<ArrayBuffer>;
  /** A bare `type/subtype`, parameters removed. */
  readonly contentType: string;
}

/** Reading one companion message aloud: the message is named, its words are found on the server. */
export interface IssueReadAloudTicketInput {
  readonly childProfileId: string;
  readonly message: CompanionMessageRef;
  /** The translated predefined lines, from server presentation code. */
  readonly wording: PredefinedWording;
}
