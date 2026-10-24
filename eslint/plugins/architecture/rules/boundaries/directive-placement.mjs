import { SERVER_ONLY_ROUTE_FILES } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const isDirective = (node, name) => node.type === 'ExpressionStatement' && node.directive === name;

/**
 * Every `'use server'` function is a public HTTP endpoint, and `'use client'` moves a whole subtree into the
 * browser bundle. Both are decided in a known place, not wherever a file happens to be.
 */
export const directivePlacement = defineRule({
  description:
    "'use server' appears only in a module's presentation/actions; route files (page, layout, route…) and the core layers are never Client Components.",
  create(context) {
    const { file } = classifyContext(context);
    const isActionFile =
      file.area === 'module' &&
      file.layer === 'presentation' &&
      file.dir === 'actions' &&
      file.rest.length === 2;
    const isRouteFile =
      file.area === 'app' && SERVER_ONLY_ROUTE_FILES.test(file.path.split('/').at(-1) ?? '');
    const isCoreLayer =
      file.area === 'module' && ['domain', 'application', 'infrastructure'].includes(file.layer);

    return {
      ExpressionStatement(node) {
        if (isDirective(node, 'use server') && !isActionFile) {
          report(
            context,
            node,
            "A 'use server' function is a public endpoint. Declare it only in a module's presentation/actions/<name>-action.ts, where the action contract checks it.",
          );
        }
        if (isDirective(node, 'use client') && (isRouteFile || isCoreLayer)) {
          report(
            context,
            node,
            isRouteFile
              ? "Pages, layouts and route files stay Server Components. Move the interactive part into a small 'use client' component and render it from here."
              : "Domain, application and infrastructure code never runs in the browser; remove the 'use client' directive.",
          );
        }
      },
    };
  },
});
