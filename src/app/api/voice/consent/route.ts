import { getVoiceCommands, getVoiceQueries, getVoiceRouteHandlers } from '@modules/voice';

/**
 * Whether the signed-in parent allows speech input (their child's recordings are sent to the
 * speech provider for transcription). No body; JSON `{ given, grantedAt, revokedAt }` out.
 *
 * @authorization protected `GetVoiceConsent` requires the signed-in parent's `voice.use` permission.
 */
export function GET(): Promise<Response> {
  return getVoiceRouteHandlers().consent(() => getVoiceQueries().getVoiceConsent.execute());
}

/**
 * The signed-in parent grants speech consent.
 *
 * @authorization protected `GrantVoiceConsent` requires the signed-in parent's `voice.use` permission.
 */
export function PUT(): Promise<Response> {
  return getVoiceRouteHandlers().consent(() => getVoiceCommands().grantVoiceConsent.execute());
}

/**
 * The signed-in parent revokes speech consent; transcription stops at once.
 *
 * @authorization protected `RevokeVoiceConsent` requires the signed-in parent's `voice.use` permission.
 */
export function DELETE(): Promise<Response> {
  return getVoiceRouteHandlers().consent(() => getVoiceCommands().revokeVoiceConsent.execute());
}
