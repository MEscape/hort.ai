import { classifyContext, defineRule, report } from '../../util.mjs';

const LEVELS = new Set(['info', 'warn']);

function isLevelRecord(typeNode) {
  if (!(typeNode?.type === 'TSTypeReference' && typeNode.typeName.name === 'Record')) return false;
  const value = typeNode.typeArguments?.params[1];
  return (
    value?.type === 'TSUnionType' &&
    value.types.length === 2 &&
    value.types.every((t) => t.type === 'TSLiteralType' && LEVELS.has(t.literal.value))
  );
}

const isCreateAuditLog = (node) =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'createAuditLog';

/**
 * The standard audit adapter: the module owns its event→level map, `@lib/logger`'s
 * `createAuditLog` owns the mechanism (structured line, module scope, contained
 * failures), so the mechanism is written and tested once.
 */
export const auditAdapter = defineRule({
  description:
    "Audit adapters declare an exhaustive event→level map and build the port with `createAuditLog('<module>.audit', LEVEL_BY_EVENT)` from '@lib/logger'.",
  create(context) {
    const { file } = classifyContext(context);
    const isAdapter =
      file.area === 'module' &&
      file.layer === 'infrastructure' &&
      file.dir === 'audit' &&
      file.rest.length === 2;
    if (!isAdapter) return {};
    let levelMapName = null;
    const calls = [];

    return {
      VariableDeclarator(node) {
        if (
          node.init?.type === 'TSSatisfiesExpression' &&
          isLevelRecord(node.init.typeAnnotation) &&
          node.id.type === 'Identifier'
        ) {
          levelMapName = node.id.name;
        }
      },
      CallExpression(node) {
        if (isCreateAuditLog(node)) calls.push(node);
      },
      ClassDeclaration(node) {
        report(
          context,
          node.id ?? node,
          "Do not hand-write the audit mechanism: export `createAuditLog('<module>.audit', LEVEL_BY_EVENT)` typed as the domain port.",
        );
      },
      'Program:exit'(program) {
        if (levelMapName === null) {
          report(
            context,
            program,
            "Define the event→level map as `const LEVEL_BY_EVENT = { … } as const satisfies Record<<Module>Event['type'], 'info' | 'warn'>` so a new event type fails to compile until it has a level.",
          );
        }
        if (calls.length !== 1) {
          report(
            context,
            program,
            "Build the adapter with exactly one `createAuditLog('<module>.audit', LEVEL_BY_EVENT)` call from '@lib/logger'.",
          );
          return;
        }
        const [scope, levels] = calls[0].arguments;
        if (!(
          scope?.type === 'Literal' &&
          typeof scope.value === 'string' &&
          /^[a-z][a-z0-9-]*\.audit$/.test(scope.value)
        )) {
          report(
            context,
            calls[0],
            "The first argument is the module-scoped logger name, a string literal like '<module>.audit'.",
          );
        }
        if (
          levelMapName !== null &&
          !(levels?.type === 'Identifier' && levels.name === levelMapName)
        ) {
          report(
            context,
            calls[0],
            `Pass \`${levelMapName}\` as the levels; do not hard-code levels.`,
          );
        }
      },
    };
  },
});
