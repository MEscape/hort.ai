import { classifyContext, defineRule, findAncestor, report } from '../../util.mjs';

const FAILURE_KINDS = new Set(['infraOnly', 'orConflict']);
const NEEDS_FACTORY = new Set(['orConflict']);
const PRISMA_CODE = /^P\d{4}$|^(?:ORM|RUNTIME|CONTRACT)\.[A-Z_]+$/;

/**
 * Prisma-backed repositories translate persistence failures in exactly one
 * way: `fromThrowableAsync(() => <db call>, failures.<kind>('<operation>', …))`
 * where `failures = createPersistenceFailures(...)` from '@lib/db'.
 */
export const persistenceFailures = defineRule({
  description:
    'Prisma repositories use createPersistenceFailures + fromThrowableAsync, with stable operation names and no local Prisma error mapping.',
  create(context) {
    const { file } = classifyContext(context);
    const isRepository =
      file.area === 'module' && file.layer === 'infrastructure' && file.dir === 'prisma';
    if (!isRepository) return {};
    const isMapper = /-record-mapper\.ts$/.test(file.file);
    const isRepositoryFile = /\.repository\.ts$/.test(file.file);

    const imported = new Map(); // local -> { source, imported }
    let failuresName = null;
    const operations = new Map();

    return {
      ImportDeclaration(node) {
        for (const s of node.specifiers) {
          imported.set(s.local.name, {
            source: node.source.value,
            name: s.type === 'ImportSpecifier' ? (s.imported.name ?? s.imported.value) : 'default',
          });
        }
        if (node.source.value === 'neverthrow') {
          report(
            context,
            node,
            "Import result helpers from '@lib/result' (the shared wrapper), not from 'neverthrow'.",
          );
        }
        if (node.source.value === '@lib/db') {
          for (const s of node.specifiers) {
            if (isMapper && s.type === 'ImportSpecifier' && s.imported.name === 'db') {
              report(
                context,
                s,
                'Record mappers are pure conversions between records and domain models; they must not access `db`.',
              );
            }
          }
        }
      },
      Literal(node) {
        if (
          typeof node.value === 'string' &&
          PRISMA_CODE.test(node.value) &&
          node.parent.type !== 'ImportDeclaration'
        ) {
          report(
            context,
            node,
            `Do not branch on Prisma/ORM error code '${node.value}' locally. Use failures.orConflict(...) so the shared mapping stays the single source of truth.`,
          );
        }
      },
      VariableDeclarator(node) {
        if (
          node.init?.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          node.init.callee.name === 'createPersistenceFailures' &&
          node.id.type === 'Identifier'
        ) {
          failuresName = node.id.name;
          if (findAncestor(node, (n) => /Function|Class/.test(n.type)) !== null) {
            report(context, node, 'Create the persistence failures once at module scope.');
          }
        }
      },
      CallExpression(node) {
        if (!isRepositoryFile) return;
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'fromThrowableAsync') return;
        // Without a failure mapper the one root cause is reported once, at Program:exit.
        if (failuresName === null) return;
        const handler = node.arguments[1];
        const isFailureCall =
          handler?.type === 'CallExpression' &&
          handler.callee.type === 'MemberExpression' &&
          handler.callee.object.type === 'Identifier' &&
          handler.callee.object.name === failuresName &&
          FAILURE_KINDS.has(handler.callee.property.name);
        if (!isFailureCall) {
          report(
            context,
            node,
            'Pass `failures.infraOnly(<operation>)` or `failures.orConflict(<operation>, <factory>)` as the error mapper of fromThrowableAsync.',
          );
          return;
        }
        const kind = handler.callee.property.name;
        const [operation, factory] = handler.arguments;
        if (operation?.type !== 'Literal' || typeof operation.value !== 'string') {
          report(
            context,
            handler,
            'Operation names are stable string literals (they appear in logs and alerts), not computed values.',
          );
        } else if (operations.has(operation.value)) {
          report(
            context,
            operation,
            `Operation name '${operation.value}' is already used in this repository; names identify one operation.`,
          );
        } else {
          operations.set(operation.value, true);
        }
        if (NEEDS_FACTORY.has(kind) && factory === undefined) {
          report(
            context,
            handler,
            `failures.${kind}(...) takes the domain error factory as its second argument.`,
          );
        }
      },
      Identifier(node) {
        if (!isRepositoryFile || (node.name !== 'db' && node.name !== 'tx')) return;
        if (node.parent.type !== 'MemberExpression' || node.parent.object !== node) return;
        const method = findAncestor(node, (n) => n.type === 'MethodDefinition');
        if (method === null) return; // module-level query builders are lazy; they only run inside a method
        const binding = imported.get(node.name);
        const isDb = node.name === 'db' && binding?.source === '@lib/db';
        const isTx = node.name === 'tx';
        if (!isDb && !isTx) return;
        // allowed: inside the first argument (a function) of fromThrowableAsync(...)
        let current = node;
        for (let parent = node.parent; parent; current = parent, parent = parent.parent) {
          if (
            parent.type === 'CallExpression' &&
            parent.callee.type === 'Identifier' &&
            parent.callee.name === 'fromThrowableAsync' &&
            parent.arguments[0] === current
          ) {
            return;
          }
          if (parent === method) break;
        }
        report(
          context,
          node,
          'Database calls must run inside `fromThrowableAsync(() => …, failures.<kind>(...))` so every persistence failure is mapped to an AppError.',
        );
      },
      'Program:exit'(program) {
        if (!isRepositoryFile) return;
        const usesDb = imported.get('db')?.source === '@lib/db';
        if (usesDb && failuresName === null) {
          report(
            context,
            program,
            "A Prisma repository must create its failure mapper: `const failures = createPersistenceFailures({ module, code, subject })` from '@lib/db'.",
          );
        }
        const importsFailures = [...imported.values()].some(
          (b) => b.name === 'createPersistenceFailures' && b.source === '@lib/db',
        );
        if (failuresName !== null && !importsFailures) {
          report(context, program, "`createPersistenceFailures` must come from '@lib/db'.");
        }
      },
    };
  },
});
