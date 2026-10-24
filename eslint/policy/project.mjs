/**
 * Loads a source tree into memory for the architecture checks.
 *
 * Parses with the same TypeScript parser ESLint uses, so the checks and the
 * lint rules read one AST model. `root` is a repository root (or a temporary
 * fixture tree with the same `src/` layout); nothing here depends on the
 * type checker, the network or the clock.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import tseslint from 'typescript-eslint';

import { moduleSpecifierVisitors } from '../plugins/architecture/util.mjs';

import { classifyFile, resolveSpecifier } from './paths.mjs';

const SKIP_DIRS = new Set(['node_modules', '.next', 'generated', '.git', 'coverage']);
const SKIP_FILES = new Set(['src/lib/db/contract.d.ts']);

function walk(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

/** Generic ESTree walk: calls `visitors[node.type]` for every node. */
export function visit(node, visitors, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visitors[node.type]?.(node, parent);
  for (const key of Object.keys(node)) {
    if (
      key === 'parent' ||
      key === 'loc' ||
      key === 'range' ||
      key === 'tokens' ||
      key === 'comments'
    )
      continue;
    const child = node[key];
    if (Array.isArray(child)) for (const c of child) visit(c, visitors, node);
    else if (child && typeof child.type === 'string') visit(child, visitors, node);
  }
}

function directivesOf(ast) {
  const found = new Set();
  for (const statement of ast.body) {
    if (statement.type !== 'ExpressionStatement' || typeof statement.directive !== 'string') break;
    found.add(statement.directive);
  }
  return found;
}

/**
 * @typedef {{ specifier: string, kind: string, isTypeOnly: boolean, names: string[] | null, line: number }} ImportRecord
 * @typedef {{ path: string, code: string, ast: any, comments: any[], directives: Set<string>, imports: ImportRecord[], info: ReturnType<typeof classifyFile> }} SourceFile
 */

export function loadProject(root) {
  /** @type {Map<string, SourceFile>} */
  const files = new Map();
  /** @type {Map<string, string>} */
  const json = new Map();

  for (const abs of walk(join(root, 'src'))) {
    const repoPath = relative(root, abs).split(sep).join('/');
    if (SKIP_FILES.has(repoPath)) continue;
    if (repoPath.endsWith('.json')) {
      json.set(repoPath, readFileSync(abs, 'utf8'));
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(repoPath) || repoPath.endsWith('.d.ts')) continue;
    if (/\.(?:test|spec)\.tsx?$/.test(repoPath)) continue;
    const code = readFileSync(abs, 'utf8');
    const parsed = tseslint.parser.parseForESLint(code, {
      range: true,
      loc: true,
      comment: true,
      filePath: abs,
      ecmaFeatures: { jsx: repoPath.endsWith('x') },
      sourceType: 'module',
    });
    const ast = parsed.ast;
    /** @type {ImportRecord[]} */
    const imports = [];
    const visitors = moduleSpecifierVisitors((record) => {
      imports.push({
        specifier: record.specifier,
        kind: record.kind,
        isTypeOnly: record.isTypeOnly,
        names: record.names,
        line: record.node.loc.start.line,
      });
    });
    visit(ast, visitors);
    files.set(repoPath, {
      path: repoPath,
      code,
      ast,
      comments: ast.comments ?? [],
      directives: directivesOf(ast),
      imports,
      info: classifyFile(repoPath),
    });
  }

  return {
    root,
    files,
    json,
    /** Module names found under src/modules. */
    modules: [
      ...new Set(
        [...files.values()].filter((f) => f.info.area === 'module').map((f) => f.info.module),
      ),
    ].sort(),
    /** Files of one module, relative to the module folder (`domain/models/x.ts`). */
    moduleFiles(name) {
      const prefix = `src/modules/${name}/`;
      return [...files.values()]
        .filter((f) => f.path.startsWith(prefix))
        .map((f) => ({ ...f, local: f.path.slice(prefix.length) }));
    },
    /** Resolves an import specifier written in `from` to a loaded source file, if it is project code. */
    resolveFile(from, specifier) {
      const resolved = resolveSpecifier(from, specifier);
      if (resolved.kind !== 'internal') return null;
      for (const candidate of [
        `${resolved.path}.ts`,
        `${resolved.path}.tsx`,
        `${resolved.path}/index.ts`,
        `${resolved.path}/index.tsx`,
      ]) {
        if (files.has(candidate)) return files.get(candidate) ?? null;
      }
      return null;
    },
  };
}

/** Classes declared at the top level of a file: `[{ name, node, exported }]`. */
export function topLevelClasses(file) {
  const classes = [];
  for (const statement of file.ast.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'ClassDeclaration' && declaration.id) {
      classes.push({
        name: declaration.id.name,
        node: declaration,
        exported: statement.type === 'ExportNamedDeclaration',
        statement,
      });
    }
  }
  return classes;
}

/** Names of every `new X(...)` expression in a file. */
export function instantiatedClasses(file) {
  const names = new Set();
  visit(file.ast, {
    NewExpression: (node) => node.callee.type === 'Identifier' && names.add(node.callee.name),
  });
  return names;
}

/** Top-level exported names of a file (values and types). */
export function exportedNames(file) {
  const names = [];
  for (const s of file.ast.body) {
    if (s.type !== 'ExportNamedDeclaration') continue;
    if (s.declaration) {
      const d = s.declaration;
      if (d.id) names.push(d.id.name);
      if (d.declarations)
        for (const v of d.declarations) if (v.id.type === 'Identifier') names.push(v.id.name);
    }
    for (const spec of s.specifiers) names.push(spec.exported.name ?? spec.exported.value);
  }
  return names;
}

/** Text of the block comment directly before a node's statement, or ''. */
export function leadingComment(file, statement) {
  const before = file.comments.filter(
    (c) =>
      c.type === 'Block' &&
      c.range[1] <= statement.range[0] &&
      file.code.slice(c.range[1], statement.range[0]).trim() === '',
  );
  return before.length > 0 ? before[before.length - 1].value : '';
}

export function violation(check, file, message) {
  return { check, file, message };
}
