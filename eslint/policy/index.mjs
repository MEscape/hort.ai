import {
  checkAuthorizationCategories,
  checkCommandAuditDependency,
  checkTranslationOwnership,
} from './checks-behavior.mjs';
import {
  checkClientServerBoundary,
  checkCompositionWiring,
  checkLayerDependencies,
  checkModuleGraph,
  checkPrismaContainment,
  checkPublicApi,
} from './checks-dependencies.mjs';
import { checkRateLimitPolicies } from './checks-rate-limits.mjs';
import { checkModuleManifests, checkModuleStructure } from './checks-structure.mjs';
import { loadProject } from './project.mjs';

/** Every whole-tree check, by name. Each takes a loaded project and returns violations. */
export const CHECKS = {
  'module manifests': checkModuleManifests,
  'module structure and capabilities': checkModuleStructure,
  'layer dependencies': checkLayerDependencies,
  'module graph (deep imports, cycles)': checkModuleGraph,
  'prisma boundary': checkPrismaContainment,
  'client/server boundary': checkClientServerBoundary,
  'composition wiring': checkCompositionWiring,
  'command audit dependency': checkCommandAuditDependency,
  'authorization categories': checkAuthorizationCategories,
  'public API': checkPublicApi,
  'translation ownership': checkTranslationOwnership,
  'rate-limit policies': checkRateLimitPolicies,
};

export function runAllChecks(root) {
  const project = loadProject(root);
  return Object.entries(CHECKS).flatMap(([name, check]) =>
    check(project).map((v) => ({ ...v, group: name })),
  );
}

export { loadProject };
