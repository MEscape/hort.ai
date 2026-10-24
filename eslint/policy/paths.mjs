/**
 * Pure path utilities shared by the ESLint plugin and the architecture
 * tests. Nothing here touches the file system or the type checker, so a lint
 * run pays only for string operations.
 */
import { posix } from 'node:path';

/** Alias -> repo-relative root, mirrors tsconfig.json `paths`. */
const ALIASES = [
  ['@modules/', 'src/modules/'],
  ['@components/', 'src/components/'],
  ['@hooks/', 'src/hooks/'],
  ['@lib/', 'src/lib/'],
  ['@i18n/', 'src/i18n/'],
  ['@types/', 'src/types/'],
  ['@/', 'src/'],
];

/**
 * Normalises to posix, repo-relative form (`src/...`). Absolute paths inside
 * `cwd` are made relative; an absolute path OUTSIDE `cwd` (a temp fixture
 * tree) is cut at its last `/src/` segment so fixtures behave like the repo.
 */
export function toRepoPath(filePath, cwd = process.cwd()) {
  const p = filePath.replace(/\\/g, '/');
  const root = cwd.replace(/\\/g, '/').replace(/\/$/, '');
  if (p.startsWith(`${root}/`)) return p.slice(root.length + 1);
  if (p.startsWith('/') || /^[A-Za-z]:\//.test(p)) {
    const srcIndex = p.lastIndexOf('/src/');
    return srcIndex === -1 ? p : p.slice(srcIndex + 1);
  }
  return p;
}

const stripExt = (p) => p.replace(/\.(?:d\.)?(?:tsx?|mjs|cjs|jsx?|json)$/, '');

/**
 * Classifies a repo-relative path.
 *
 * `{ area: 'module', module, layer, dir, rest, file }` for files below
 * `src/modules/<m>/`, otherwise `{ area: 'lib' | 'components' | ... }`.
 */
export function classifyFile(repoPath) {
  const parts = repoPath.split('/');
  if (parts[0] !== 'src') return { area: 'other', path: repoPath };
  if (parts[1] !== 'modules' || parts.length < 4) {
    const area = parts[1] ?? 'other';
    return {
      area: ['lib', 'components', 'app', 'i18n', 'hooks', 'types'].includes(area) ? area : 'other',
      path: repoPath,
    };
  }
  const module = parts[2];
  const below = parts.slice(3); // e.g. ['application','commands','x.ts']
  const file = below[below.length - 1];
  const first = below[0];
  if (below.length === 1) {
    return {
      area: 'module',
      module,
      layer: 'root',
      dir: '',
      rest: below,
      file,
      path: repoPath,
    };
  }
  const isLayer = ['domain', 'application', 'infrastructure', 'presentation'].includes(first);
  return {
    area: 'module',
    module,
    layer: isLayer ? first : 'unknown',
    dir: below.length > 2 ? below[1] : '',
    rest: below.slice(1),
    file,
    path: repoPath,
  };
}

/**
 * Resolves an import specifier written in `fromRepoPath` to a classified
 * target. Packages resolve to `{ kind: 'package', name }`.
 */
export function resolveSpecifier(fromRepoPath, specifier) {
  let target = null;
  if (specifier.startsWith('.')) {
    target = posix.normalize(posix.join(posix.dirname(fromRepoPath), specifier));
  } else if (specifier === '@i18n') {
    target = 'src/i18n/index';
  } else {
    const alias = ALIASES.find(([prefix]) => specifier.startsWith(prefix));
    if (alias) target = alias[1] + specifier.slice(alias[0].length);
    else if (specifier === '@modules') target = 'src/modules';
  }
  if (target === null) {
    return { kind: 'package', specifier, name: packageName(specifier) };
  }
  target = stripExt(target).replace(/\/index$/, '');
  const info = classifyFile(target);
  if (info.area === 'module') {
    const isRoot = info.rest.length === 1 && info.layer === 'root' && info.file === undefined;
    return { kind: 'internal', specifier, path: target, ...info, isRoot };
  }
  // `src/modules/<m>` (the public API) has only three segments.
  const parts = target.split('/');
  if (parts[0] === 'src' && parts[1] === 'modules' && parts.length === 3) {
    return {
      kind: 'internal',
      specifier,
      path: target,
      area: 'module',
      module: parts[2],
      layer: 'root',
      dir: '',
      rest: [],
      file: 'index',
      isPublicApi: true,
    };
  }
  return { kind: 'internal', specifier, path: target, ...info };
}

export function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** `@lib/<name>/...` -> `<name>`; null for anything else. */
export function sharedLibName(resolved) {
  if (resolved.kind !== 'internal' || resolved.area !== 'lib') return null;
  return resolved.path.split('/')[2] ?? null;
}

/** True when the resolved import is another module's public API: `@modules/x` or its browser-safe `@modules/x/client`. */
export function isPublicApiOf(resolved) {
  return (
    resolved.kind === 'internal' &&
    resolved.area === 'module' &&
    (resolved.isPublicApi === true ||
      (resolved.layer === 'root' && (resolved.file === 'index' || resolved.file === 'client')))
  );
}

/** `lesson-plans` -> `lessonPlans` (the namespace casing used by module translation catalogs). */
export function kebabToCamel(kebab) {
  const pascal = kebabToPascal(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** `create-lesson.ts` -> `CreateLesson`. */
export function kebabToPascal(kebab) {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function stripFileExtension(name) {
  return name.replace(/\.(?:tsx?|mjs|json)$/, '');
}
