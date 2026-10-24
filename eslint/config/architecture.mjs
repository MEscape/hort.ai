import architecture from '../plugins/architecture/index.mjs';

import { SOURCE_FILES, TEST_FILES } from './globs.mjs';

/**
 * Custom architecture rules. Every rule derives what it needs from the
 * file's own path and the central policy (eslint/policy/policy.mjs),
 * so a new standard module is covered without touching this file.
 * Rules that apply to one kind of file are scoped by glob for readability;
 * each also guards itself, so scoping is an optimisation, not the contract.
 */
export const architectureRules = [
  {
    files: SOURCE_FILES,
    ignores: TEST_FILES,
    plugins: { architecture },
    rules: {
      // boundaries
      'architecture/layer-imports': 'error',
      'architecture/no-cross-module-deep-imports': 'error',
      'architecture/no-i18n-in-core': 'error',
      'architecture/field-error-bag-owner': 'error',
      'architecture/directive-placement': 'error',
      // structure
      'architecture/module-structure': 'error',
      'architecture/module-public-api': 'error',
      // core layers
      'architecture/no-throw-in-core-layers': 'error',
      'architecture/application-flow': 'error',
      'architecture/use-case-helpers': 'error',
      'architecture/command-query-shape': 'error',
      'architecture/command-audit-dependency': 'error',
      'architecture/authorization-flow': 'error',
      'architecture/limits-usage': 'error',
      'architecture/rate-limit-usage': 'error',
      'architecture/branded-id-usage': 'error',
      // adapters
      'architecture/persistence-failures': 'error',
      'architecture/owner-scope': 'error',
      'architecture/audit-adapter': 'error',
      // presentation
      'architecture/action-contract': 'error',
      'architecture/component-logic': 'error',
      'architecture/ui-composition': 'error',

      'architecture/dto-serialization': 'error',
      'architecture/form-conventions': 'error',
      'architecture/message-key-coverage': 'error',
      'architecture/route-usage': 'error',
      'architecture/unsaved-work-guard': 'error',
      // pages
      'architecture/metadata-conventions': 'error',
      'architecture/heading-hierarchy': 'error',
    },
  },
];
