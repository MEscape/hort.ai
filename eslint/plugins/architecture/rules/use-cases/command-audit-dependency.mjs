import { classifyContext, defineRule, memberPath, report } from '../../util.mjs';

/**
 * Two separate guarantees, deliberately not conflated:
 *
 *  1. DEPENDENCY: every command receives the module's audit-log adapter.
 *     That needs the dependency interface, which lives in another file, so it
 *     is resolved end to end by `__tests__/architecture` (command → its
 *     `*Dependencies` → an `audit` member typed as the module's audit port).
 *     This rule keeps the part a single file can prove: a command is never
 *     built from a `Public*` dependency set.
 *  2. EMISSION: a command records at least one event with a literal
 *     `type`, unless its class doc says `@audit-exempt <reason>`. Having the
 *     dependency never implies that every code path emits.
 */
export const commandAuditDependency = defineRule({
  description:
    'Commands are not built from public dependency sets and record typed audit events; exemptions are explicit.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module' || file.layer !== 'application') return {};
    if (file.dir === 'commands' && file.rest.length === 2) return commandFile();
    return {};

    function commandFile() {
      let depsName = null;
      let classNode = null;
      let recordCalls = 0;
      let exempt = false;
      const sourceCode = context.sourceCode;
      return {
        ClassDeclaration(node) {
          classNode = node;
          const ctor = node.body.body.find(
            (m) => m.type === 'MethodDefinition' && m.kind === 'constructor',
          );
          const param = ctor?.value.params[0];
          const annotation =
            param?.type === 'TSParameterProperty'
              ? param.parameter.typeAnnotation?.typeAnnotation
              : undefined;
          if (annotation?.type === 'TSTypeReference' && annotation.typeName.type === 'Identifier')
            depsName = annotation.typeName.name;
          const comments = sourceCode.getCommentsBefore(
            node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node,
          );
          exempt = comments.some((c) => /@audit-exempt\s+\S/.test(c.value));
        },
        CallExpression(node) {
          const path = node.callee.type === 'MemberExpression' ? memberPath(node.callee) : null;
          if (path === null || !/(?:^|\.)audit\.record$/.test(path)) return;
          recordCalls += 1;
          const [event] = node.arguments;
          const hasLiteralType =
            event?.type === 'ObjectExpression' &&
            event.properties.some(
              (p) =>
                p.type === 'Property' &&
                p.key.name === 'type' &&
                p.value.type === 'Literal' &&
                typeof p.value.value === 'string',
            );
          if (!hasLiteralType) {
            report(
              context,
              node,
              "Record a typed audit event: pass an object literal with a literal `type` (e.g. `audit.record({ type: 'session.started', ... })`) so the event union stays exhaustive.",
            );
          }
        },
        'Program:exit'() {
          if (classNode === null) return;
          if (depsName !== null && depsName.startsWith('Public')) {
            report(
              context,
              classNode.id,
              `Commands are audited and must not be built from the public dependency set \`${depsName}\`. Use a dependency interface that includes \`audit\`.`,
            );
          }
          if (recordCalls === 0 && !exempt) {
            report(
              context,
              classNode.id,
              'This command never records an audit event. Call `audit.record({ type: ... })` for its successful outcome, or document an intentional exception with `@audit-exempt <reason>` in the class comment.',
            );
          }
        },
      };
    }
  },
});
