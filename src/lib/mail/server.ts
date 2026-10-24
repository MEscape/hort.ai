import 'server-only';

import { serverEnv } from '@lib/config/server';
import { once } from '@lib/utils';

import { createMailTransport } from './create-mail-transport';

import type { MailTransport } from './mail-transport';

export { resolveMailLocale } from './mail-locale';

/**
 * The one transport of this process, or `null` while `MAIL_PROVIDER=none`.
 * Modules keep their own messages and wording; they only share how a message
 * leaves. Built on first use, so importing this needs no mail configuration
 * at build time.
 */
export const getMailTransport = once<MailTransport | null>(() => createMailTransport(serverEnv));
