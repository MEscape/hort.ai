/**
 * Helpers shared by the rules. Everything is syntactic (no type checker, no
 * file system) so enabling a rule costs one AST walk per file.
 */
import { classifyFile, resolveSpecifier, toRepoPath } from '../../policy/paths.mjs';

/** Repo-relative posix path of the linted file. */
export function repoPathOf(context) {
  return toRepoPath(context.filename ?? context.getFilename(), context.cwd ?? process.cwd());
}

export function classifyContext(context) {
  const repoPath = repoPathOf(context);
  return { repoPath, file: classifyFile(repoPath) };
}

/** Stable "docs" link target used in rule metadata. */
export const DOCS_URL = 'eslint/README.md';

/**
 * Builds a rule module with the plugin-wide conventions: one `violation`
 * message whose text is produced by the rule so it can name the violated
 * convention and the approved alternative.
 */
export function defineRule({
  description,
  schema = [],
  create,
  extraMessages = {},
  type = 'problem',
}) {
  return {
    meta: {
      type,
      docs: { description, url: DOCS_URL },
      schema,
      messages: { violation: '{{detail}}', ...extraMessages },
    },
    create,
  };
}

export function report(context, node, detail) {
  context.report({ node, messageId: 'violation', data: { detail } });
}

/**
 * Visits every static module specifier in a file: imports, re-exports,
 * `import()`, `require()` and `import('x').Type`.
 * The callback receives `{ node, specifier, isTypeOnly, kind, names }`;
 * `names` is the list of imported/exported names or `null` for namespace/side-effect forms.
 */
export function moduleSpecifierVisitors(onSpecifier) {
  const literal = (node) =>
    node && node.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
  return {
    ImportDeclaration(node) {
      const specifier = literal(node.source);
      if (specifier === null) return;
      const named = node.specifiers.filter((s) => s.type === 'ImportSpecifier');
      const allInlineType =
        node.specifiers.length > 0 &&
        node.specifiers.every((s) => s.type === 'ImportSpecifier' && s.importKind === 'type');
      onSpecifier({
        node,
        specifier,
        kind: 'import',
        isTypeOnly: node.importKind === 'type' || allInlineType,
        names:
          node.specifiers.length === named.length && named.length > 0
            ? named.map((s) => s.imported.name ?? s.imported.value)
            : null,
      });
    },
    ExportNamedDeclaration(node) {
      const specifier = literal(node.source);
      if (specifier === null) return;
      onSpecifier({
        node,
        specifier,
        kind: 'export',
        isTypeOnly:
          node.exportKind === 'type' ||
          (node.specifiers.length > 0 && node.specifiers.every((s) => s.exportKind === 'type')),
        names: node.specifiers.map((s) => s.local.name ?? s.local.value),
      });
    },
    ExportAllDeclaration(node) {
      const specifier = literal(node.source);
      if (specifier !== null)
        onSpecifier({
          node,
          specifier,
          kind: 'export-all',
          isTypeOnly: node.exportKind === 'type',
          names: null,
        });
    },
    ImportExpression(node) {
      const specifier = literal(node.source);
      if (specifier !== null)
        onSpecifier({ node, specifier, kind: 'dynamic', isTypeOnly: false, names: null });
    },
    TSImportType(node) {
      const arg =
        node.argument?.type === 'TSLiteralType'
          ? literal(node.argument.literal)
          : literal(node.argument);
      if (arg !== null)
        onSpecifier({ node, specifier: arg, kind: 'import-type', isTypeOnly: true, names: null });
    },
    CallExpression(node) {
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments.length === 1
      ) {
        const specifier = literal(node.arguments[0]);
        if (specifier !== null)
          onSpecifier({ node, specifier, kind: 'require', isTypeOnly: false, names: null });
      }
    },
  };
}

export function resolveFrom(repoPath, specifier) {
  return resolveSpecifier(repoPath, specifier);
}

/** True when the program starts with the given directive (`'use client'`, `'use server'`). */
export function hasDirective(program, name) {
  for (const statement of program.body) {
    if (statement.type !== 'ExpressionStatement' || typeof statement.directive !== 'string')
      return false;
    if (statement.directive === name) return true;
  }
  return false;
}

/** Walks up to the nearest ancestor satisfying `predicate`. */
export function findAncestor(node, predicate) {
  for (let current = node.parent; current; current = current.parent) {
    if (predicate(current)) return current;
  }
  return null;
}

/** Name of an Identifier / `a.b` member chain's last property, else null. */
export function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  )
    return callee.property.name;
  return null;
}

/** `a.b.c` -> 'a.b.c' for simple member chains (including `this.deps.x`), else null. */
export function memberPath(node) {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    const object = memberPath(node.object);
    return object === null ? null : `${object}.${node.property.name}`;
  }
  return null;
}

export function isNumericLiteral(node) {
  return (
    (node.type === 'Literal' && typeof node.value === 'number') ||
    (node.type === 'UnaryExpression' &&
      node.argument.type === 'Literal' &&
      typeof node.argument.value === 'number')
  );
}

export { classifyFile };
