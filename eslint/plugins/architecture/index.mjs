/**
 * eslint-plugin-architecture
 *
 * Enforces the module architecture described in
 * eslint/README.md. All rules are syntactic and read
 * the central policy in eslint/policy/policy.mjs; none of them needs the
 * type checker or the file system, and none names a module.
 */
import { auditAdapter } from './rules/adapters/audit-adapter.mjs';
import { ownerScope } from './rules/adapters/owner-scope.mjs';
import { persistenceFailures } from './rules/adapters/persistence-failures.mjs';
import { directivePlacement } from './rules/boundaries/directive-placement.mjs';
import { fieldErrorBagOwner } from './rules/boundaries/field-error-bag-owner.mjs';
import { layerImports } from './rules/boundaries/layer-imports.mjs';
import { noCrossModuleDeepImports } from './rules/boundaries/no-cross-module-deep-imports.mjs';
import { noI18nInCore } from './rules/boundaries/no-i18n-in-core.mjs';
import { headingHierarchy } from './rules/pages/heading-hierarchy.mjs';
import { metadataConventions } from './rules/pages/metadata-conventions.mjs';
import { actionContract } from './rules/presentation/action-contract.mjs';
import { componentLogic } from './rules/presentation/component-logic.mjs';
import { dtoSerialization } from './rules/presentation/dto-serialization.mjs';
import { formConventions } from './rules/presentation/form-conventions.mjs';
import { messageKeyCoverage } from './rules/presentation/message-key-coverage.mjs';
import { routeUsage } from './rules/presentation/route-usage.mjs';
import { uiComposition } from './rules/presentation/ui-composition.mjs';
import { unsavedWorkGuard } from './rules/presentation/unsaved-work-guard.mjs';
import { modulePublicApi } from './rules/structure/module-public-api.mjs';
import { moduleStructure } from './rules/structure/module-structure.mjs';
import { applicationFlow } from './rules/use-cases/application-flow.mjs';
import { authorizationFlow } from './rules/use-cases/authorization-flow.mjs';
import { brandedIdUsage } from './rules/use-cases/branded-id-usage.mjs';
import { commandAuditDependency } from './rules/use-cases/command-audit-dependency.mjs';
import { commandQueryShape } from './rules/use-cases/command-query-shape.mjs';
import { limitsUsage } from './rules/use-cases/limits-usage.mjs';
import { noThrowInCoreLayers } from './rules/use-cases/no-throw-in-core-layers.mjs';
import { rateLimitUsage } from './rules/use-cases/rate-limit-usage.mjs';
import { useCaseHelpers } from './rules/use-cases/use-case-helpers.mjs';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'eslint-plugin-architecture', version: '1.0.0' },
  rules: {
    'action-contract': actionContract,
    'application-flow': applicationFlow,
    'audit-adapter': auditAdapter,
    'authorization-flow': authorizationFlow,
    'branded-id-usage': brandedIdUsage,
    'command-audit-dependency': commandAuditDependency,
    'command-query-shape': commandQueryShape,
    'component-logic': componentLogic,
    'directive-placement': directivePlacement,
    'dto-serialization': dtoSerialization,
    'field-error-bag-owner': fieldErrorBagOwner,
    'form-conventions': formConventions,
    'heading-hierarchy': headingHierarchy,
    'layer-imports': layerImports,
    'limits-usage': limitsUsage,
    'message-key-coverage': messageKeyCoverage,
    'metadata-conventions': metadataConventions,
    'module-public-api': modulePublicApi,
    'module-structure': moduleStructure,
    'no-cross-module-deep-imports': noCrossModuleDeepImports,
    'no-i18n-in-core': noI18nInCore,
    'no-throw-in-core-layers': noThrowInCoreLayers,
    'persistence-failures': persistenceFailures,
    'rate-limit-usage': rateLimitUsage,
    'owner-scope': ownerScope,
    'route-usage': routeUsage,
    'ui-composition': uiComposition,
    'unsaved-work-guard': unsavedWorkGuard,
    'use-case-helpers': useCaseHelpers,
  },
};

export default plugin;
