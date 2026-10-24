export const I18N_ERROR_CODES = {
  messagesLoadFailed: 'i18n.messagesLoadFailed',
  missingMessage: 'i18n.missingMessage',
  invalidMessageKey: 'i18n.invalidMessageKey',
  unsupportedLocale: 'i18n.unsupportedLocale',
} as const satisfies Record<string, string>;

export type I18nErrorCode = (typeof I18N_ERROR_CODES)[keyof typeof I18N_ERROR_CODES];

export function resolveMessageByCode(code: string): `errors.${string}` {
  return `errors.${code}`;
}
