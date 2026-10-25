import { getTranslations } from '@i18n/server';

import type { PredefinedWording } from '../../application/contracts/voice-constraints';

/**
 * Server-only wording of safe, predefined companion lines. This is content for speech, not an
 * error translation: the action still returns stable codes for the browser to word itself.
 */
export async function predefinedWording(): Promise<PredefinedWording> {
  const t = await getTranslations('guidance');
  return (key) => t(key as Parameters<typeof t>[0]);
}
