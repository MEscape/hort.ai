import { RATE_LIMIT_POLICIES } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, memberPath, report } from '../../util.mjs';

/** `@authorization public <reason>` in the class comment: a use case anyone can run, with no actor. */
const PUBLIC_TAG = /@authorization\s+public\b/;
/** `@rate-limit none <reason>`: the stated reason a public use case spends no budget. */
const NO_LIMIT_TAG = /@rate-limit\s+none\s+\S/;
/** Any `@rate-limit` tag, to catch one that lacks its reason. */
const ANY_LIMIT_TAG = /@rate-limit\b/;

const {
  file: POLICIES_FILE,
  exportName: POLICIES_EXPORT,
  type: POLICIES_TYPE,
} = RATE_LIMIT_POLICIES;
const POLICIES_IMPORTS = new Set(RATE_LIMIT_POLICIES.allowedImports);

const ENFORCE_METHODS = new Set(['enforce', 'enforceAll']);
const RATE_LIMITER_RECEIVER = /(?:^|\.)rateLimiter$/;

const GUIDE = 'docs/architecture/rate-limiting.md';

const isPolicyRead = (node) =>
  node.object.type === 'Identifier' && POLICIES_EXPORT.test(node.object.name);

/** `rateLimiter.enforce(...)` and `rateLimiter.enforceAll(...)`. */
function isEnforceCall(node) {
  if (node.callee.type !== 'MemberExpression' || node.callee.computed) return false;
  if (!ENFORCE_METHODS.has(node.callee.property.name)) return false;
  const receiver = memberPath(node.callee.object);
  return receiver !== null && RATE_LIMITER_RECEIVER.test(receiver);
}

/** The `policy:` properties of the request object(s) passed to `enforce` / `enforceAll`. */
function policyProperties(call) {
  const [argument] = call.arguments;
  const requests = argument?.type === 'ArrayExpression' ? argument.elements : [argument];
  return requests
    .filter((request) => request?.type === 'ObjectExpression')
    .flatMap((request) =>
      request.properties.filter(
        (property) => property.type === 'Property' && property.key.name === 'policy',
      ),
    );
}

/**
 * Rate limiting is declared once and applied in one place:
 *
 *  - POLICIES are plain data in the module's `application/rate-limits.ts`
 *    (`export const <NAME>_RATE_LIMITS = { ... } as const satisfies Record<string, RateLimitPolicy>`),
 *    so every budget can be reviewed, tested and found in one file.
 *  - USE CASES spend them. A use case anyone can run (`@authorization public`) spends a
 *    budget from that file or states why it need not: `@rate-limit none <reason>`.
 *    The limiter only ever sees a policy that file declares, never an inline one.
 *  - NOTHING ELSE calls the limiter: actions, adapters and the domain reach it through
 *    a use case, so a budget cannot be skipped by calling a different entry point.
 *
 * Importing the limiter at runtime is `layer-imports`' job (`@lib/rate-limit` is a port).
 * Whether every policy is valid, unique and fails the right way is checked across modules
 * by `__tests__/architecture/rate-limit-policies.test.ts`.
 */
export const rateLimitUsage = defineRule({
  description:
    'Rate-limit policies are plain data in application/rate-limits.ts; public use cases spend one or state why not; only use cases call the limiter.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module') return {};

    if (file.layer !== 'application') return enforceOnlyInApplication();
    if (file.rest.length === 1 && file.file === POLICIES_FILE) return policiesFile();
    const isUseCase = (file.dir === 'commands' || file.dir === 'queries') && file.rest.length === 2;
    return isUseCase ? useCaseFile() : inlinePolicyVisitors();

    function enforceOnlyInApplication() {
      return {
        CallExpression(node) {
          if (!isEnforceCall(node)) return;
          report(
            context,
            node,
            `Only a use case (application layer) may call the rate limiter. Call it from the use case this code serves, so a budget cannot be skipped by calling a different entry point. See ${GUIDE}.`,
          );
        },
      };
    }

    function inlinePolicyVisitors() {
      return {
        CallExpression(node) {
          if (!isEnforceCall(node)) return;
          for (const property of policyProperties(node)) {
            if (property.value.type !== 'ObjectExpression') continue;
            report(
              context,
              property,
              `Pass a policy declared in application/rate-limits.ts, not an inline object: budgets are declared in one file so they can be reviewed and tested. See ${GUIDE}.`,
            );
          }
        },
      };
    }

    function useCaseFile() {
      let classNode = null;
      let isPublic = false;
      let hasNoLimitTag = false;
      let hasMalformedTag = false;
      let readsPolicy = false;

      return {
        ...inlinePolicyVisitors(),
        ClassDeclaration(node) {
          classNode ??= node;
          const owner = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node;
          const comments = context.sourceCode.getCommentsBefore(owner).map((c) => c.value);
          isPublic ||= comments.some((text) => PUBLIC_TAG.test(text));
          hasNoLimitTag ||= comments.some((text) => NO_LIMIT_TAG.test(text));
          hasMalformedTag ||= comments.some(
            (text) => ANY_LIMIT_TAG.test(text) && !NO_LIMIT_TAG.test(text),
          );
        },
        MemberExpression(node) {
          if (isPolicyRead(node)) readsPolicy = true;
        },
        'Program:exit'() {
          if (classNode === null) return;
          if (hasMalformedTag) {
            report(
              context,
              classNode.id,
              'Write the opt-out as `@rate-limit none <reason>`: a public use case that spends no budget says why in the class comment.',
            );
          }
          if (hasNoLimitTag && readsPolicy) {
            report(
              context,
              classNode.id,
              'This use case is tagged `@rate-limit none` but spends a budget. Remove the tag or stop spending the budget.',
            );
          }
          if (isPublic && !hasNoLimitTag && !hasMalformedTag && !readsPolicy) {
            report(
              context,
              classNode.id,
              `A public use case runs for anyone, so it spends a budget declared in application/rate-limits.ts (\`<NAME>_RATE_LIMITS.<policy>\`), or states why it need not with \`@rate-limit none <reason>\` in the class comment. See ${GUIDE} and docs/rules/security.md.`,
            );
          }
        },
      };
    }

    function policiesFile() {
      const sourceCode = context.sourceCode;
      return {
        ImportDeclaration(node) {
          const specifier = node.source.value;
          if (!POLICIES_IMPORTS.has(specifier)) {
            report(
              context,
              node,
              `rate-limits.ts is plain data: it may import only ${[...POLICIES_IMPORTS].join(' and ')}, not '${specifier}'.`,
            );
          } else if (specifier === '@lib/rate-limit' && node.importKind !== 'type') {
            report(
              context,
              node,
              "Import the policy type with `import type`: '@lib/rate-limit' is a port, wired only by composition.ts.",
            );
          }
        },
        ExportNamedDeclaration(node) {
          const declaration = node.declaration;
          if (declaration?.type !== 'VariableDeclaration') {
            report(
              context,
              node,
              'rate-limits.ts exports policy data only: `export const <NAME>_RATE_LIMITS = { … } as const satisfies Record<string, RateLimitPolicy>`.',
            );
            return;
          }
          for (const declarator of declaration.declarations) {
            checkExport(declarator);
          }
        },
        ExportDefaultDeclaration(node) {
          report(
            context,
            node,
            'rate-limits.ts exports named policy data only, never a default export.',
          );
        },
      };

      function checkExport(declarator) {
        const name = declarator.id.type === 'Identifier' ? declarator.id.name : null;
        if (name === null || !POLICIES_EXPORT.test(name)) {
          report(
            context,
            declarator.id,
            'Name the export `<NAME>_RATE_LIMITS` (UPPER_SNAKE_CASE, ending in `_RATE_LIMITS`).',
          );
        }
        const init = declarator.init;
        if (
          init?.type !== 'TSSatisfiesExpression' ||
          sourceCode.getText(init.typeAnnotation) !== POLICIES_TYPE
        ) {
          report(
            context,
            declarator,
            `End the declaration with \`satisfies ${POLICIES_TYPE}\`, so a policy missing a field does not compile (the failure mode is required, never defaulted).`,
          );
          return;
        }
        const object =
          init.expression.type === 'TSAsExpression' ? init.expression.expression : null;
        if (object?.type !== 'ObjectExpression') {
          report(context, init, 'Declare the policies as one object literal `{ … } as const`.');
          return;
        }
        for (const entry of object.properties) {
          const policy = entry.type === 'Property' ? entry.value : null;
          const id =
            policy?.type === 'ObjectExpression'
              ? policy.properties.find((p) => p.type === 'Property' && p.key.name === 'id')
              : null;
          if (id?.value.type !== 'Literal' || typeof id.value.value !== 'string') {
            report(
              context,
              entry,
              "Give every policy a literal string `id` (`'module.operation'`): it becomes part of the stored key and of the logs.",
            );
          }
        }
      }
    }
  },
});
