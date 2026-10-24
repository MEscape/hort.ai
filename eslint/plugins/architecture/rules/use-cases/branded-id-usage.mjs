import { BRAND_TYPE_NAME, policyFor } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const ID_PARAM = /^(?:id|[a-z][A-Za-z0-9]*Id)$/;

/** Branded identifiers: minted in `domain/models/ids.ts`, used everywhere else. */
export const brandedIdUsage = defineRule({
  description:
    'Brand constructors live in domain/models/ids.ts; ports and repositories take branded ids, not string.',
  create(context) {
    const { file } = classifyContext(context);
    if (file.area !== 'module') return {};
    const isIdsFile = file.layer === 'domain' && file.rest.join('/') === 'models/ids.ts';
    const inPort = file.layer === 'domain' && file.dir === 'ports';
    const inAdapter =
      file.layer === 'infrastructure' &&
      ((file.dir === 'prisma' && /\.repository\.ts$/.test(file.file)) ||
        file.dir === 'provisioner');
    const policy = policyFor(file.module, context.cwd);

    const visitors = {};
    if (!isIdsFile) {
      const castTarget = (node) => {
        const type = node.typeAnnotation;
        if (
          type?.type === 'TSTypeReference' &&
          type.typeName.type === 'Identifier' &&
          BRAND_TYPE_NAME.test(type.typeName.name)
        ) {
          report(
            context,
            node,
            `Do not cast to the branded id \`${type.typeName.name}\`. Use \`to${type.typeName.name}(raw)\` for stored values or \`parse${type.typeName.name}(raw)\` for request values (domain/models/ids.ts).`,
          );
        }
      };
      visitors.TSAsExpression = castTarget;
      visitors.TSTypeAssertion = castTarget;
    }

    if (isIdsFile) {
      const brands = [];
      const functions = new Set();
      Object.assign(visitors, {
        TSTypeAliasDeclaration(node) {
          const ref = node.typeAnnotation;
          if (
            ref.type === 'TSTypeReference' &&
            ref.typeName.name === 'Brand' &&
            BRAND_TYPE_NAME.test(node.id.name)
          )
            brands.push(node.id);
        },
        FunctionDeclaration(node) {
          if (node.id) functions.add(node.id.name);
        },
        // `export const parseItemId = createIdParser(...)` is as good as a function declaration.
        VariableDeclarator(node) {
          if (node.id.type === 'Identifier' && node.init) functions.add(node.id.name);
        },
        'Program:exit'() {
          for (const id of brands) {
            const base = id.name;
            if (!functions.has(`to${base}`))
              report(
                context,
                id,
                `Branded id \`${base}\` needs a trusted constructor \`to${base}(raw: string): ${base}\` for values read from storage.`,
              );
            if (policy.role.brandParsersRequired && !functions.has(`parse${base}`)) {
              report(
                context,
                id,
                `Branded id \`${base}\` needs a validating parser \`parse${base}(raw: string): AppResult<${base}, ValidationAppError>\` for request values.`,
              );
            }
          }
        },
      });
    }

    if (inPort || inAdapter) {
      const check = (node, name, annotation) => {
        if (ID_PARAM.test(name) && annotation?.type === 'TSStringKeyword') {
          report(
            context,
            node,
            `\`${name}\` is an identifier and crosses a ${inPort ? 'port' : 'repository/adapter'} boundary as plain \`string\`. Use the branded id type (e.g. \`ChildId\`, \`LessonId\`) so validated ids cannot be confused with free text.`,
          );
        }
      };
      visitors.Identifier = (node) => {
        const parent = node.parent;
        if (!parent?.params?.includes(node)) return;
        const isPortSignature =
          inPort &&
          /TSMethodSignature|TSDeclareFunction|TSFunctionType|TSEmptyBodyFunctionExpression|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression/.test(
            parent.type,
          );
        // Adapters: only the parameters of class methods (the port implementations).
        const isAdapterMethod =
          inAdapter &&
          parent.type === 'FunctionExpression' &&
          parent.parent?.type === 'MethodDefinition';
        if (isPortSignature || isAdapterMethod)
          check(node, node.name, node.typeAnnotation?.typeAnnotation);
      };
      if (inPort) {
        visitors.TSPropertySignature = (node) => {
          if (node.key.type === 'Identifier')
            check(node, node.key.name, node.typeAnnotation?.typeAnnotation);
        };
      }
    }
    return visitors;
  },
});
