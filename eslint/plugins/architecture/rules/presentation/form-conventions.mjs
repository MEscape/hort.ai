import { classifyContext, defineRule, report } from '../../util.mjs';

const FORM_METHODS = new Set([
  'setError',
  'register',
  'setValue',
  'getValues',
  'watch',
  'trigger',
  'clearErrors',
  'resetField',
  'unregister',
  'useController',
  'useWatch',
  'useFieldArray',
  'getFieldState',
]);

function isDynamicDottedPath(node) {
  if (node.type === 'TemplateLiteral') {
    return (
      (node.expressions.length >= 2 &&
        node.quasis.slice(1, -1).some((q) => q.value.cooked?.includes('.'))) ||
      (node.expressions.length >= 1 &&
        node.quasis.slice(0, -1).some((q) => q.value.cooked?.endsWith('.')))
    );
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const text = (n) => (n.type === 'Literal' && typeof n.value === 'string' ? n.value : '');
    return (
      text(node.left).includes('.') ||
      text(node.right).includes('.') ||
      isDynamicDottedPath(node.left) ||
      isDynamicDottedPath(node.right)
    );
  }
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.name === 'join'
  ) {
    const [separator] = node.arguments;
    return separator?.type === 'Literal' && separator.value === '.';
  }
  return false;
}

/** Forms: React Hook Form + Zod resolver + the shared server-error routing. */
export const formConventions = defineRule({
  description:
    'Forms use react-hook-form with zodResolver, applyActionError for server errors, ROOT_FIELD for form-level errors and fieldPath() for dynamic nested names.',
  create(context) {
    const { file } = classifyContext(context);
    const isComponent =
      file.area === 'module' && file.layer === 'presentation' && file.dir === 'components';
    if (!isComponent) return {};
    const imports = new Map();
    let usesForm = false;
    let importsAction = false;
    let callsApplyActionError = false;

    return {
      ImportDeclaration(node) {
        for (const s of node.specifiers) imports.set(s.local.name, node.source.value);
        if (/\/actions\/[^/]+-action$/.test(node.source.value)) importsAction = true;
      },
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression'
              ? callee.property.name
              : null;
        if (callee.type === 'Identifier' && callee.name === 'useForm') {
          usesForm = true;
          if (imports.get('useForm') !== 'react-hook-form')
            report(context, node, "Import `useForm` from 'react-hook-form'.");
          const [options] = node.arguments;
          const resolver =
            options?.type === 'ObjectExpression'
              ? options.properties.find((p) => p.type === 'Property' && p.key.name === 'resolver')
              : undefined;
          const isZod =
            resolver?.value.type === 'CallExpression' &&
            resolver.value.callee.type === 'Identifier' &&
            resolver.value.callee.name === 'zodResolver';
          if (!isZod) {
            report(
              context,
              node,
              "Validate with the module schema: `useForm({ resolver: zodResolver(<schema>) })` ('@hookform/resolvers/zod'); do not hand-write validation in the component.",
            );
          } else if (imports.get('zodResolver') !== '@hookform/resolvers/zod') {
            report(context, resolver, "`zodResolver` comes from '@hookform/resolvers/zod'.");
          }
        }
        if (callee.type === 'Identifier' && callee.name === 'applyActionError') {
          callsApplyActionError = true;
          if (imports.get('applyActionError') !== '@lib/actions')
            report(context, node, "Import `applyActionError` from '@lib/actions'.");
        }
        if (
          name !== null &&
          FORM_METHODS.has(name) &&
          node.arguments.length > 0 &&
          isDynamicDottedPath(node.arguments[0])
        ) {
          report(
            context,
            node.arguments[0],
            "Build nested dotted field names with `fieldPath(...)` from '@lib/errors' so they match the paths the server reports; do not concatenate dots by hand.",
          );
        }
        if (
          name === 'setError' &&
          node.arguments[0]?.type === 'Literal' &&
          node.arguments[0].value === '_form'
        ) {
          report(
            context,
            node.arguments[0],
            "Use `ROOT_FIELD` from '@lib/errors' for form-level errors instead of the '_form' literal.",
          );
        }
      },
      JSXAttribute(node) {
        if (node.name.name !== 'name' || node.value?.type !== 'JSXExpressionContainer') return;
        if (isDynamicDottedPath(node.value.expression))
          report(
            context,
            node,
            "Use `fieldPath(...)` from '@lib/errors' for dynamic nested `name` values.",
          );
      },
      MemberExpression(node) {
        // Only a react-hook-form form routes server errors into fields; a panel that merely lists a failure may read them.
        const usesReactHookForm = [...imports.values()].includes('react-hook-form');
        if (
          usesReactHookForm &&
          node.property.type === 'Identifier' &&
          node.property.name === 'fieldErrors' &&
          !node.computed
        ) {
          report(
            context,
            node,
            'Do not re-implement server-error routing. `applyActionError(result.error, setError, codeFields)` maps field errors (and focuses the first one) for you.',
          );
        }
      },
      'Program:exit'(program) {
        if (importsAction && usesForm && !callsApplyActionError) {
          report(
            context,
            program,
            "A form that submits to a Server Action must route failures through `applyActionError(result.error, setError, …)` from '@lib/actions'.",
          );
        }
      },
    };
  },
});
