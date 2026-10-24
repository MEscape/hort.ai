import createMiddleware from 'next-intl/middleware';

import { I18N_ROUTING } from '@i18n';

/** Locale negotiation only. Authorization remains in application use cases. */
export const proxy = createMiddleware(I18N_ROUTING);

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
