import {
  DIR_FILE_PATTERNS,
  GENERIC_NAMES,
  LAYERS,
  LAYER_DIRS,
  LAYER_ROOT_FILES,
  MODULE_ROOT_FILES,
  OPEN_LAYERS,
  policyFor,
} from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const describe = (patterns) =>
  patterns
    .map((p) =>
      p instanceof RegExp
        ? p.source
            .replace(/\\\./g, '.')
            .replace(/\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*/g, '<name>')
            .replace(/^\^|\$$/g, '')
        : p,
    )
    .join(' | ');

/**
 * Path-only structure check: every file sits in an approved place with an
 * approved name. Capability requirements (e.g. "a repository port has an
 * adapter") need the whole tree and live in `__tests__/architecture`.
 * Modules are never asked to create files they do not need.
 */
export const moduleStructure = defineRule({
  description:
    'Every module file lives in an approved layer folder with an approved file-name shape.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module') return {};
    const policy = policyFor(file.module, context.cwd);
    const below = file.path.split('/').slice(3);

    return {
      Program(node) {
        const problem = check();
        if (problem !== null) report(context, node, problem);
      },
    };

    function check() {
      const baseName = below[below.length - 1].replace(/(?:\.[a-z]+)+$/, '');
      if (GENERIC_NAMES.includes(baseName)) {
        return `'${below[below.length - 1]}' says nothing about its content. Name the file for what it does (docs/rules/naming.md); generic names (${GENERIC_NAMES.join(', ')}) are rejected.`;
      }
      if (below.length === 1) {
        const allowed = [...MODULE_ROOT_FILES];
        return allowed.includes(below[0])
          ? null
          : `'${below[0]}' is not allowed at the module root. Module root files: ${allowed.join(', ')}. Everything else belongs in domain/, application/, infrastructure/ or presentation/.`;
      }
      const [layer, second, ...rest] = below;
      if (!LAYERS.includes(layer)) {
        return `'${layer}' is not a layer folder. A module contains ${LAYERS.join(', ')} (plus ${MODULE_ROOT_FILES.join(', ')}).`;
      }
      if (below[below.length - 1] === 'index.ts') {
        return 'Barrel files are only allowed as a module public API (index.ts / client.ts at the module root). Import the file you need directly.';
      }
      if (rest.length === 0) {
        const rootFiles = [...LAYER_ROOT_FILES[layer], ...(policy.extraRootFiles[layer] ?? [])];
        const ok = rootFiles.some((entry) =>
          entry instanceof RegExp ? entry.test(second) : entry === second,
        );
        return ok
          ? null
          : `'${second}' cannot sit directly in ${layer}/.${rootFiles.length > 0 ? ` Allowed here: ${describe(rootFiles)}.` : ''} Place it in one of: ${[...LAYER_DIRS[layer], ...(policy.extraDirs[layer] ?? [])].join(', ')}${OPEN_LAYERS.includes(layer) ? ' (or a folder named for what it holds)' : ''}.`;
      }
      const dirs = [...LAYER_DIRS[layer], ...(policy.extraDirs[layer] ?? [])];
      if (!dirs.includes(second)) {
        const open = OPEN_LAYERS.includes(layer);
        if (open && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(second) && !GENERIC_NAMES.includes(second))
          return null;
        return open
          ? `'${layer}/${second}/' is not a valid folder name. Use kebab-case and name it for what it holds (not ${GENERIC_NAMES.join(', ')}).`
          : `'${layer}/${second}/' is not an approved folder. ${layer}/ contains: ${dirs.join(', ')}.`;
      }
      const patterns = DIR_FILE_PATTERNS[`${layer}/${second}`];
      if (patterns === undefined || patterns === null) return null;
      if (rest.length > 1)
        return `${layer}/${second}/ is flat; '${rest.join('/')}' must not be nested.`;
      return patterns.some((p) => p.test(rest[0]))
        ? null
        : `'${rest[0]}' does not follow the ${layer}/${second}/ naming convention. Expected: ${describe(patterns)}.`;
    }
  },
});
