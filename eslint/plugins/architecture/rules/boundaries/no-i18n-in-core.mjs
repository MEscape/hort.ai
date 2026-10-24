import { I18N_VOCABULARY_ALLOW } from '../../../../policy/policy.mjs';
import {
  moduleSpecifierVisitors,
  classifyContext,
  defineRule,
  report,
  resolveFrom,
} from '../../util.mjs';

const I18N_PACKAGES = /^next-intl($|\/)/;
const TRANSLATION_CALLS = new Set(['useTranslations', 'getTranslations', 'getTranslation']);

/** Domain and application return stable codes; presentation turns codes into text. */
export const noI18nInCore = defineRule({
  description: 'Forbid i18n dependencies and translation calls in domain and application code.',
  create(context) {
    const { repoPath, file } = classifyContext(context);
    if (file.area !== 'module' || (file.layer !== 'domain' && file.layer !== 'application'))
      return {};
    const layer = file.layer;
    return {
      ...moduleSpecifierVisitors(({ node, specifier, isTypeOnly, names }) => {
        const target = resolveFrom(repoPath, specifier);
        const isI18n =
          I18N_PACKAGES.test(specifier) ||
          (target.kind === 'internal' &&
            (target.area === 'i18n' ||
              /\/presentation\/(?:i18n|messages)(?:\/|$)/.test(target.path)));
        const isLocaleVocabulary =
          isTypeOnly &&
          target.kind === 'internal' &&
          target.area === 'i18n' &&
          names !== null &&
          names.length > 0 &&
          names.every((n) => I18N_VOCABULARY_ALLOW.includes(n));
        if (isI18n && !isLocaleVocabulary) {
          report(
            context,
            node,
            `The ${layer} layer must not depend on i18n ('${specifier}'). Return a stable error/validation code; presentation maps codes to translation keys (presentation/messages/message-keys.ts).`,
          );
        }
      }),
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && TRANSLATION_CALLS.has(node.callee.name)) {
          report(
            context,
            node,
            `Do not translate in the ${layer} layer ('${node.callee.name}'). Keep translation text out of business logic; use stable codes.`,
          );
        }
      },
    };
  },
});
