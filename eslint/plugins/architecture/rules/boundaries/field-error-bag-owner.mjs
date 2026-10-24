import { classifyContext, defineRule, report } from '../../util.mjs';

/**
 * `new FieldErrorBag(...)` wires a bag to a module's validation-error
 * factory. That wiring exists exactly once per module, in domain/errors.
 */
export const fieldErrorBagOwner = defineRule({
  description: 'Restrict FieldErrorBag construction to the canonical domain/errors location.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area === 'lib' && file.path.startsWith('src/lib/errors/')) return {};
    const isOwner = file.area === 'module' && file.layer === 'domain' && file.dir === 'errors';
    if (isOwner) return {};
    return {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'FieldErrorBag') {
          report(
            context,
            node,
            "Construct `FieldErrorBag` only in the module's domain/errors/<module>-errors.ts (as `create<Module>ErrorBag()`), and call that factory here.",
          );
        }
      },
    };
  },
});
