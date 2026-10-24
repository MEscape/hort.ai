import { COMPONENT_LOGIC, componentLogicScope } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const HOOK_NAME = /^use[A-Z0-9]/;
const COMPONENT_NAME = /^[A-Z]/;
/** What a Server Component awaits to get its words and formats: composing, like a hook. */
const SERVER_TOOL = /^get(Translations|Locale|Formatter|Format|Messages|Now|TimeZone)$/;

/** The name a function is declared with: `function Name`, `const Name = () =>`, `memo`/`forwardRef` wrappers. */
function nameOf(node) {
  if (node.id?.name) return node.id.name;
  let parent = node.parent;
  while (parent?.type === 'CallExpression') parent = parent.parent;
  return parent?.type === 'VariableDeclarator' ? (parent.id.name ?? null) : null;
}

/** A call `useState(...)` or `React.useState(...)`: the hook's name, else null. */
function calledName(node) {
  const { callee } = node;
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed) return callee.property.name;
  return null;
}

/**
 * `const x = useSomething(...)`, `useSomething(...)` or `const t = await getTranslations(...)`: composing,
 * not logic. React's own state and effect hooks are logic, so they are not composition: they count.
 */
function isComposition(statement, counted) {
  const value =
    statement.type === 'ExpressionStatement'
      ? statement.expression
      : statement.type === 'VariableDeclaration' && statement.declarations.length === 1
        ? statement.declarations[0].init
        : null;
  const call = value?.type === 'AwaitExpression' ? value.argument : value;
  const name = call?.type === 'CallExpression' ? (calledName(call) ?? '') : '';
  return (HOOK_NAME.test(name) && !counted.has(name)) || SERVER_TOOL.test(name);
}

/**
 * docs/rules/react.md: a component draws what it is given. A little logic next to the markup is fine (one
 * `useState`, a derived value); once it does more than a few things, it is a hook waiting to be extracted.
 * What counts is every statement before the `return` that is not a call to one of our hooks: derived values,
 * handlers, and React's own state and effect hooks.
 */
export const componentLogic = defineRule({
  description:
    'A component does at most a few things (state, effects, derived values, handlers) besides calling hooks and returning markup; more belongs in a hook.',
  schema: [
    {
      type: 'object',
      properties: {
        maxStatements: { type: 'integer', minimum: 0 },
        hooks: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  ],
  create(context) {
    const options = context.options[0] ?? {};
    const maxStatements = options.maxStatements ?? COMPONENT_LOGIC.maxStatements;
    const counted = new Set(options.hooks ?? COMPONENT_LOGIC.countedHooks);
    const { repoPath, file } = classifyContext(context);
    if (!repoPath.endsWith('.tsx') || !componentLogicScope(file)) {
      return {};
    }

    function checkBody(node) {
      const name = nameOf(node);
      if (name === null || !COMPONENT_NAME.test(name) || node.body.type !== 'BlockStatement') {
        return;
      }
      const count = node.body.body.filter(
        (s) => s.type !== 'ReturnStatement' && !isComposition(s, counted),
      ).length;
      if (count > maxStatements) {
        report(
          context,
          node,
          `${name} does ${count} things besides calling hooks and returning markup (at most ${maxStatements}). Move the state, derived values and handlers into a hook (use-*.ts) next to it and call that. See docs/rules/react.md.`,
        );
      }
    }

    return { FunctionDeclaration: checkBody, ArrowFunctionExpression: checkBody };
  },
});
