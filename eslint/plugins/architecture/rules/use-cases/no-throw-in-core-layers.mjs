import { classifyContext, defineRule, findAncestor, report } from '../../util.mjs';

/**
 * Expected failures are values (`AppResult` / `AppResultAsync`), never
 * exceptions. What stays legal:
 *
 *  - `try`/`catch` itself (containment of third-party throws is the point of
 *    `fromThrowable*`, the persistence failure helpers and the audit sink).
 *  - re-throwing the *caught binding* unchanged (`catch (e) { cleanup(); throw e; }`):
 *    that is containment that declines to translate, not a business throw.
 *  - a file that declares `'use cache'`: a cached function does not cache a
 *    thrown error, so a typed failure is thrown through the cache boundary.
 *
 * The module's composition root (fail-fast on invalid configuration while the
 * process boots) sits at the module root, which is not one of these layers.
 */
export const noThrowInCoreLayers = defineRule({
  description:
    'Forbid `throw` and custom Error subclasses for expected failures in domain, application and infrastructure.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module') return {};
    if (!['domain', 'application', 'infrastructure'].includes(file.layer)) return {};
    // A `'use cache'` function does not cache a thrown error, so a typed failure is thrown THROUGH the cache and
    // converted back to an AppError by the caller. That containment lives in the file that declares the directive.
    const crossesCacheBoundary = /^\s*['"]use cache(?::\s*[\w-]+)?['"]/m.test(
      context.sourceCode.text,
    );

    return {
      ThrowStatement(node) {
        if (crossesCacheBoundary) return;
        const catchClause = findAncestor(node, (n) => n.type === 'CatchClause');
        if (
          catchClause?.param?.type === 'Identifier' &&
          node.argument.type === 'Identifier' &&
          node.argument.name === catchClause.param.name
        ) {
          return;
        }
        report(
          context,
          node,
          `Do not \`throw\` in the ${file.layer} layer. Return \`err(<domain error>)\` / \`errAsync(...)\` (AppResult/AppResultAsync from '@lib/result') using this module's domain errors; wrap third-party calls with fromThrowable/fromThrowableAsync.`,
        );
      },
      ClassDeclaration(node) {
        if (crossesCacheBoundary) return;
        if (node.superClass?.type === 'Identifier' && /Error$/.test(node.superClass.name)) {
          report(
            context,
            node,
            `Do not define Error subclasses in the ${file.layer} layer. Use the AppError kinds and factories from '@lib/errors' (domain/errors/<module>-errors.ts).`,
          );
        }
      },
    };
  },
});
