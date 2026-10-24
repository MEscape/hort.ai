import { classifyContext, defineRule, findAncestor, hasDirective, report } from '../../util.mjs';

const INVALIDATORS = new Set(['revalidatePath', 'revalidateTag', 'updateTag', 'refresh']);
const SCHEMA_PARSE = new Set(['parse', 'safeParse', 'parseAsync', 'safeParseAsync']);
const FLOW_CALLBACKS = new Set(['map', 'andThen', 'asyncMap', 'asyncAndThen', 'andTee']);

const isUnknown = (param) =>
  (param.type === 'AssignmentPattern' ? param.left : param).typeAnnotation?.typeAnnotation?.type ===
  'TSUnknownKeyword';

/**
 * Server Action flow: unknown input -> shared parser -> composition use case
 * -> invalidate after success -> DTO -> toActionResult.
 */
export const actionContract = defineRule({
  description:
    'Server Actions: validate unknown input with the module parser, call composition, invalidate only after success, return toActionResult with a DTO (never a view).',
  create(context) {
    const { file } = classifyContext(context);
    const isAction =
      file.area === 'module' &&
      file.layer === 'presentation' &&
      file.dir === 'actions' &&
      file.rest.length === 2;
    if (!isAction) return {};

    const sources = new Map(); // local -> import source

    return {
      Program(node) {
        if (!hasDirective(node, 'use server'))
          report(context, node, "A Server Action file starts with the 'use server' directive.");
      },
      ImportDeclaration(node) {
        for (const s of node.specifiers) sources.set(s.local.name, node.source.value);
        const translates =
          node.specifiers.some(
            (s) =>
              s.type === 'ImportSpecifier' && /Translat(?:ions|or)$/.test(s.imported.name ?? ''),
          ) && /^(?:next-intl|@i18n)/.test(node.source.value);
        if (translates) {
          report(
            context,
            node,
            'Actions return stable error codes; they never translate. Components map codes to text (presentation/messages/message-keys.ts).',
          );
        }
        if (node.source.value === 'zod' || node.source.value.startsWith('zod/')) {
          report(
            context,
            node,
            "Do not use Zod directly in an action. Validate with the module's `parse<Module>Input(schema, input)` helper (built with createActionInputParser) and keep schemas in presentation/schemas.",
          );
        }
      },
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;
        if (
          !declaration ||
          declaration.type === 'TSTypeAliasDeclaration' ||
          declaration.type === 'TSInterfaceDeclaration'
        )
          return;
        if (declaration.type !== 'FunctionDeclaration' || !declaration.async) {
          report(
            context,
            node,
            'A Server Action file may only export `async function` actions (Next.js rejects other exports). Move constants and helpers to another file.',
          );
          return;
        }
        checkAction(declaration);
      },
      ExportDefaultDeclaration(node) {
        report(context, node, 'Use a named export for Server Actions.');
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          SCHEMA_PARSE.has(callee.property.name) &&
          node.arguments.length <= 1
        ) {
          report(
            context,
            node,
            `Do not call \`.${callee.property.name}()\` in an action. Use \`parse<Module>Input(schema, input)\` so validation errors become stable, serialisable codes.`,
          );
        }
        if (callee.type === 'Identifier' && INVALIDATORS.has(callee.name)) {
          const guarded = findAncestor(node, (n) => {
            if (n.type === 'IfStatement')
              return /\bisOk\b|\.ok\b/.test(context.sourceCode.getText(n.test));
            if (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression') {
              const call = n.parent;
              return (
                call.type === 'CallExpression' &&
                call.callee.type === 'MemberExpression' &&
                FLOW_CALLBACKS.has(call.callee.property.name)
              );
            }
            return false;
          });
          if (guarded === null) {
            report(
              context,
              node,
              `Call ${callee.name}() only after a successful mutation: inside \`if (result.isOk()) { … }\` or a \`.map(...)\`/\`.andThen(...)\` callback. Failed commands must not invalidate caches.`,
            );
          }
        }
      },
    };

    function checkAction(fn) {
      const name = fn.id.name;
      for (const param of fn.params) {
        if (!isUnknown(param)) {
          report(
            context,
            param,
            `\`${name}\` must accept untrusted input as \`unknown\` and validate it with the module parser; a typed parameter would let unvalidated data look trusted.`,
          );
        }
      }
      const returnType = fn.returnType?.typeAnnotation;
      const isPromiseOfActionResult =
        returnType?.type === 'TSTypeReference' &&
        returnType.typeName.name === 'Promise' &&
        returnType.typeArguments?.params[0]?.type === 'TSTypeReference' &&
        returnType.typeArguments.params[0].typeName.name === 'ActionResult';
      if (!isPromiseOfActionResult) {
        report(
          context,
          fn.returnType ?? fn.id,
          `\`${name}\` returns \`Promise<ActionResult<T>>\` (from '@lib/result').`,
        );
      } else {
        // Application views carry Dates and internal fields; a result is a DTO, an inline shape, or a rendered node.
        const payload = returnType.typeArguments.params[0].typeArguments?.params[0];
        if (
          payload?.type === 'TSTypeReference' &&
          payload.typeName.type === 'Identifier' &&
          /View$/.test(payload.typeName.name)
        ) {
          report(
            context,
            payload,
            `\`${name}\` returns the application view \`${payload.typeName.name}\`. Map it to a \`…Dto\` (JSON-safe, only what clients need) before it crosses the action boundary.`,
          );
        }
      }

      let parses = fn.params.length === 0;
      let executes = false;
      // `return`s inside callbacks (`.map((v) => { …; return v; })`) belong to the callback, not the action.
      const visit = (node, insideCallback = false) => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'CallExpression') {
          const callee = node.callee;
          if (callee.type === 'Identifier' && /^parse[A-Z]\w*Input$/.test(callee.name)) {
            parses = true;
            if (!/\/schemas\/parse-/.test(sources.get(callee.name) ?? '')) {
              report(
                context,
                node,
                `Import \`${callee.name}\` from the module's presentation/schemas/parse-<module>-input.`,
              );
            }
          }
          if (callee.type === 'MemberExpression' && callee.property.name === 'execute') {
            // `shopCommands.create.execute()` or the lazy form `getShopCommands().create.execute()`.
            let root = callee.object;
            while (root.type === 'MemberExpression') root = root.object;
            const rootName =
              root.type === 'CallExpression' && root.callee.type === 'Identifier'
                ? root.callee.name
                : root.type === 'Identifier'
                  ? root.name
                  : null;
            if (rootName && /\/composition$/.test(sources.get(rootName) ?? '')) executes = true;
          }
        }
        if (node.type === 'ReturnStatement' && node.argument && !insideCallback)
          checkReturn(node, name);
        const nested = insideCallback || /Function/.test(node.type);
        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;
          const child = node[key];
          if (Array.isArray(child)) child.forEach((c) => visit(c, nested));
          else if (child && typeof child.type === 'string') visit(child, nested);
        }
      };
      visit(fn.body);
      if (!parses)
        report(
          context,
          fn.id,
          `\`${name}\` never calls the module's \`parse<Module>Input(schema, input)\`; untrusted input must be validated before a use case sees it.`,
        );
      if (!executes)
        report(
          context,
          fn.id,
          `\`${name}\` must call a use case through the module's composition root (\`<module>Commands.<x>.execute(...)\` / \`<module>Queries.<x>.execute(...)\`).`,
        );
    }

    function checkReturn(node, name) {
      const arg = node.argument;
      const isToActionResult =
        arg.type === 'CallExpression' &&
        arg.callee.type === 'Identifier' &&
        arg.callee.name === 'toActionResult';
      if (!isToActionResult) {
        report(
          context,
          node,
          `\`${name}\` must return \`toActionResult(result…)\`. Do not hand-build \`{ ok, error }\` objects or return raw results: toActionResult is the one serializer of AppErrors.`,
        );
      }
    }
  },
});
