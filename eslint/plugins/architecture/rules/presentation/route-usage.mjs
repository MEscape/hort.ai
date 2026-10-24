import { classifyContext, defineRule, report } from '../../util.mjs';

const NAVIGATION = new Set(['revalidatePath', 'redirect', 'permanentRedirect']);
const ROUTER_METHODS = new Set(['push', 'replace', 'prefetch']);

function startsWithInternalPath(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return /^\/[^/]/.test(node.value);
  if (node.type === 'TemplateLiteral') return /^\/[^/]/.test(node.quasis[0].value.cooked ?? '');
  return false;
}

/** Module-owned paths come from `presentation/routes.ts`. */
export const routeUsage = defineRule({
  description:
    "Forbid hand-written internal route templates in a module's actions and components; use presentation/routes.ts.",
  create(context) {
    const { file } = classifyContext(context);
    const applies =
      file.area === 'module' &&
      file.layer === 'presentation' &&
      (file.dir === 'actions' || file.dir === 'components');
    if (!applies) return {};
    const message = (module) =>
      `Do not hard-code an internal path. Use the canonical route helper from presentation/routes.ts (e.g. \`${module}Routes.detail(id)\`); another module's paths come from its public API.`;
    return {
      CallExpression(node) {
        const callee = node.callee;
        const [first] = node.arguments;
        if (!first || !startsWithInternalPath(first)) return;
        const isNavigation = callee.type === 'Identifier' && NAVIGATION.has(callee.name);
        const isRouter =
          callee.type === 'MemberExpression' &&
          ROUTER_METHODS.has(callee.property.name) &&
          /router/i.test(context.sourceCode.getText(callee.object));
        if (isNavigation || isRouter) report(context, first, message(file.module));
      },
      JSXAttribute(node) {
        if (node.name.name !== 'href' || !node.value) return;
        const value =
          node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
        if (startsWithInternalPath(value)) report(context, node, message(file.module));
      },
    };
  },
});
