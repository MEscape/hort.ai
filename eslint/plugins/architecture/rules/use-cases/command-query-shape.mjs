import { kebabToPascal, stripFileExtension } from '../../../../policy/paths.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const RESULT_TYPES = new Set(['AppResult', 'AppResultAsync']);
const UNTYPED_ERRORS = new Set(['unknown', 'any', 'Error']);
const FORBIDDEN_COLLABORATOR = /(?:Repository|AuditLog|Provisioner|Service|Gateway|Client)$/;

function typeName(typeNode) {
  return typeNode?.type === 'TSTypeReference' && typeNode.typeName.type === 'Identifier'
    ? typeNode.typeName.name
    : null;
}

/** Shape contract shared by commands and queries (one class, constructor DI, single `execute`). */
export const commandQueryShape = defineRule({
  description:
    'Commands and queries: one class per file named after the file, constructor-injected *Dependencies, a single public `execute` returning a typed AppResult.',
  create(context) {
    const { file } = classifyContext(context);
    const isUseCase =
      file.area === 'module' &&
      file.layer === 'application' &&
      (file.dir === 'commands' || file.dir === 'queries') &&
      file.rest.length === 2;
    if (!isUseCase) return {};
    const kind = file.dir === 'commands' ? 'command' : 'query';
    const expectedClass = kebabToPascal(stripFileExtension(file.file));
    const dependencyImports = new Map(); // local name -> source

    return {
      ImportDeclaration(node) {
        for (const specifier of node.specifiers)
          dependencyImports.set(specifier.local.name, node.source.value);
      },
      'Program:exit'(program) {
        const classes = [];
        for (const statement of program.body) {
          const declaration =
            statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
          if (declaration?.type === 'ClassDeclaration')
            classes.push({ declaration, exported: statement.type === 'ExportNamedDeclaration' });
          if (
            statement.type === 'ExportNamedDeclaration' &&
            declaration &&
            ['FunctionDeclaration', 'VariableDeclaration'].includes(declaration.type)
          ) {
            report(
              context,
              statement,
              `A ${kind} file exports its class (and types) only. Move helpers to a private method, a domain function, or application/${'<module>'}-view-mappers.ts.`,
            );
          }
          if (statement.type === 'ExportDefaultDeclaration')
            report(context, statement, `Use a named export: \`export class ${expectedClass}\`.`);
        }
        if (classes.length !== 1) {
          report(
            context,
            program,
            `A ${kind} file contains exactly one class (found ${classes.length}). One use case per file.`,
          );
          return;
        }
        const [{ declaration, exported }] = classes;
        if (!exported) report(context, declaration, `Export the ${kind} class.`);
        if (declaration.id?.name !== expectedClass) {
          report(
            context,
            declaration.id ?? declaration,
            `Class name must match the file name: '${file.file}' declares \`${expectedClass}\` (found \`${declaration.id?.name}\`).`,
          );
        }
        checkMembers(declaration);
      },
    };

    function checkMembers(classNode, useCaseKind = kind) {
      const members = classNode.body.body;
      const constructors = members.filter(
        (m) => m.type === 'MethodDefinition' && m.kind === 'constructor',
      );
      if (constructors.length !== 1) {
        report(
          context,
          classNode,
          `A ${useCaseKind} declares one constructor that receives its dependencies (\`constructor(private readonly deps: <Module>Dependencies)\`).`,
        );
      } else {
        checkConstructor(constructors[0]);
      }

      const publicMethods = members.filter(
        (m) =>
          m.type === 'MethodDefinition' &&
          m.kind === 'method' &&
          !m.static &&
          (m.accessibility ?? 'public') === 'public',
      );
      const execute = publicMethods.filter((m) => m.key.name === 'execute');
      if (execute.length !== 1 || publicMethods.length !== 1) {
        const extras = publicMethods
          .filter((m) => m.key.name !== 'execute')
          .map((m) => m.key.name ?? '?');
        report(
          context,
          extras.length > 0 ? publicMethods.find((m) => m.key.name !== 'execute') : classNode,
          `A ${useCaseKind} has exactly one public entry point named \`execute\`${extras.length > 0 ? ` (also public: ${extras.join(', ')}; make helpers \`private\`)` : ''}.`,
        );
      }
      for (const member of members) {
        if (
          member.type === 'PropertyDefinition' &&
          (member.accessibility ?? 'public') === 'public' &&
          !member.static
        ) {
          report(
            context,
            member,
            `Do not expose state on a ${useCaseKind}. Dependencies are \`private readonly\` constructor parameters.`,
          );
        }
      }
      if (execute.length === 1) checkExecute(execute[0].value, useCaseKind);

      classNode.body.body.forEach((member) => {
        if (member.type === 'MethodDefinition' || member.type === 'PropertyDefinition')
          findCollaboratorConstruction(member);
      });
    }

    function checkConstructor(ctor) {
      const params = ctor.value.params;
      const [param] = params;
      const parameter = param?.type === 'TSParameterProperty' ? param : null;
      const annotation = parameter?.parameter.typeAnnotation?.typeAnnotation;
      const name = typeName(annotation);
      if (
        params.length !== 1 ||
        parameter === null ||
        parameter.accessibility !== 'private' ||
        !parameter.readonly ||
        name === null
      ) {
        report(
          context,
          ctor,
          `Inject dependencies with a single \`private readonly deps: <Module>Dependencies\` constructor parameter.`,
        );
        return;
      }
      const source = dependencyImports.get(name);
      if (!/^\.\.\/[a-z0-9-]+-dependencies$/.test(source ?? '') || !name.endsWith('Dependencies')) {
        report(
          context,
          parameter,
          `Dependency interfaces are centralised in application/<module>-dependencies.ts: import \`${name}\` from there instead of declaring or sourcing it elsewhere.`,
        );
      }
    }

    function checkExecute(fn, useCaseKind) {
      const returnType = fn.returnType?.typeAnnotation;
      const name = typeName(returnType);
      if (name === null || !RESULT_TYPES.has(name)) {
        report(
          context,
          fn.returnType ?? fn,
          `\`execute\` of a ${useCaseKind} declares its return type as AppResultAsync<Value, ErrorUnion> (or AppResult) from '@lib/result', so expected failures are part of the signature.`,
        );
        return;
      }
      const args = returnType.typeArguments?.params ?? [];
      const errorArg = args[1];
      if (
        args.length !== 2 ||
        errorArg.type === 'TSUnknownKeyword' ||
        errorArg.type === 'TSAnyKeyword' ||
        UNTYPED_ERRORS.has(typeName(errorArg) ?? '')
      ) {
        report(
          context,
          returnType,
          `Spell out the error union (e.g. \`AppResultAsync<View, AuthorizationError | InfrastructureAppError>\`); an untyped error hides failures from callers.`,
        );
      }
      if (useCaseKind === 'query' && isArrayType(args[0]) && !hasLimitsImport()) {
        report(
          context,
          returnType,
          `A query that returns a list must be bounded by application/<module>-limits.ts. Import its limits and apply them (see architecture/limits-usage).`,
        );
      }
    }

    function hasLimitsImport() {
      return [...dependencyImports.values()].some((source) =>
        /^\.\.\/[a-z0-9-]+-limits$/.test(source),
      );
    }

    function findCollaboratorConstruction(member) {
      const visit = (node) => {
        if (!node || typeof node.type !== 'string') return;
        if (
          node.type === 'NewExpression' &&
          node.callee.type === 'Identifier' &&
          FORBIDDEN_COLLABORATOR.test(node.callee.name)
        ) {
          report(
            context,
            node,
            `Do not construct \`${node.callee.name}\` inside a ${kind}. Collaborators are injected and wired in composition.ts.`,
          );
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;
          const child = node[key];
          if (Array.isArray(child)) child.forEach(visit);
          else if (child && typeof child.type === 'string') visit(child);
        }
      };
      visit(member.value);
    }
  },
});

function isArrayType(node) {
  if (!node) return false;
  if (node.type === 'TSArrayType') return true;
  if (node.type === 'TSTypeOperator') return isArrayType(node.typeAnnotation);
  return (
    node.type === 'TSTypeReference' &&
    node.typeName.type === 'Identifier' &&
    ['Array', 'ReadonlyArray'].includes(node.typeName.name)
  );
}
