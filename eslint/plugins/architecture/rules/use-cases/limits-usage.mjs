import { LIMIT_NAME_PATTERN } from '../../../../policy/policy.mjs';
import {
  classifyContext,
  defineRule,
  findAncestor,
  isNumericLiteral,
  report,
} from '../../util.mjs';

const LIMIT_CALLS = new Set(['limit', 'take']);
const LIMIT_PROPS = /^(?:limit|take|pageSize|perPage|maxItems|maxResults|batchSize)$/i;
const TRIVIAL = new Set([0, 1]);

const numeric = (node) =>
  isNumericLiteral(node) &&
  !TRIVIAL.has(node.type === 'Literal' ? node.value : -node.argument.value);

/** Query/list bounds are application policy and live in `application/<module>-limits.ts`. */
export const limitsUsage = defineRule({
  description:
    "Flag hard-coded query/list bounds that bypass the module's application/*-limits.ts file.",
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module') return {};
    const inApplication =
      file.layer === 'application' && !(file.rest.length === 1 && /-limits\.ts$/.test(file.file));
    const inRepository = file.layer === 'infrastructure' && file.dir === 'prisma';
    const inAction = file.layer === 'presentation' && file.dir === 'actions';
    if (!inApplication && !inRepository && !inAction) return {};
    const hint = 'Define it in application/<module>-limits.ts and import it.';

    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !LIMIT_NAME_PATTERN.test(node.id.name)) return;
        if (
          node.init &&
          (numeric(node.init) ||
            (node.init.type === 'ObjectExpression' &&
              node.init.properties.some((p) => p.type === 'Property' && numeric(p.value))))
        ) {
          report(
            context,
            node,
            `Limit constant '${node.id.name}' must not be declared here. ${hint}`,
          );
        }
      },
      CallExpression(node) {
        const name =
          node.callee.type === 'MemberExpression' ? node.callee.property.name : node.callee.name;
        if (LIMIT_CALLS.has(name) && node.arguments.length > 0 && numeric(node.arguments[0])) {
          report(
            context,
            node,
            `Hard-coded bound passed to .${name}(). Receive the limit from the application layer (${hint.toLowerCase()})`,
          );
        }
        // Any two literal bounds are a limit, including 1 (a minimum of 1 is still a bound).
        if (name === 'clamp' && node.arguments.filter(isNumericLiteral).length >= 2) {
          report(context, node, `Clamp bounds are limits. ${hint}`);
        }
      },
      Property(node) {
        if (
          node.key.type === 'Identifier' &&
          LIMIT_PROPS.test(node.key.name) &&
          numeric(node.value) &&
          findAncestor(node, (n) => n.type === 'ObjectExpression')
        ) {
          report(context, node, `Hard-coded '${node.key.name}'. ${hint}`);
        }
      },
      AssignmentPattern(node) {
        if (
          node.left.type === 'Identifier' &&
          LIMIT_PROPS.test(node.left.name) &&
          numeric(node.right)
        ) {
          report(context, node, `Default value for '${node.left.name}' is a limit. ${hint}`);
        }
      },
    };
  },
});
