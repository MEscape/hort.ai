/**
 * Module manifests: how a module that differs from the standard one says so.
 *
 * A module declares its differences in `src/modules/<name>/module.json`, next to the code they excuse, so the
 * exception is reviewed with the module and nothing in `eslint/` has to name it. A standard module has no
 * manifest. Every key is optional except `reason`, which says why the module is not standard:
 *
 *   {
 *     "role": "platform",                       // a key of ROLES (default: "business")
 *     "reason": "…",                            // at least MIN_REASON_LENGTH characters
 *     "extraRootFiles": { "application": ["authorization-service.ts"] },
 *     "extraDirs": { "infrastructure": ["connector"] },
 *     "compositionFile": "composition.ts",
 *     "runtimeExports": ["actorHasPermission"]  // pure exports other modules' application code may call
 *   }
 *
 * `checkModuleManifests` (eslint/policy/checks-structure.mjs) validates every manifest against the real tree.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST_FILE = 'module.json';
export const MIN_REASON_LENGTH = 40;
export const MANIFEST_KEYS = [
  'role',
  'reason',
  'extraRootFiles',
  'extraDirs',
  'compositionFile',
  'runtimeExports',
];

const cache = new Map();

/** The parsed manifest of a module, `null` for a standard module or an unreadable file (reported by the check). */
export function readManifest(moduleName, root = process.cwd()) {
  const key = `${root}\0${moduleName}`;
  if (cache.has(key)) return cache.get(key);
  const path = join(root, 'src', 'modules', moduleName, MANIFEST_FILE);
  let manifest = null;
  if (existsSync(path)) {
    try {
      manifest = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      manifest = null;
    }
  }
  cache.set(key, manifest);
  return manifest;
}
