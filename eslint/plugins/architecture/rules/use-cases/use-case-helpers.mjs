import { USE_CASE_HELPERS } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const isFunctionValue = (node) =>
  node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';

/** The declaration inside `export ...`, or the statement itself. */
const declarationOf = (statement) =>
  statement.type === 'ExportNamedDeclaration' ? (statement.declaration ?? statement) : statement;

/** Functions declared beside the class: `function f() {}` and `const f = () => {}`. */
function functionsBesideClass(program) {
  return program.body
    .map(declarationOf)
    .filter(
      (statement) =>
        statement.type === 'FunctionDeclaration' ||
        (statement.type === 'VariableDeclaration' &&
          statement.declarations.some((d) => isFunctionValue(d.init))),
    );
}

/** Methods of the use case's class other than the constructor and `execute`. */
function extraMethods(program) {
  return program.body
    .map(declarationOf)
    .filter((statement) => statement.type === 'ClassDeclaration')
    .flatMap((klass) => klass.body.body)
    .filter(
      (member) =>
        member.type === 'MethodDefinition' &&
        member.kind === 'method' &&
        member.key.name !== 'execute',
    );
}

/**
 * A command or query is the story of one use case. The pieces it needs - parsing, loading context, deciding,
 * mapping to views - go into `application/services`, one file per job; a use case that carries more than a few
 * helpers of its own is a service waiting to be extracted.
 */
export const useCaseHelpers = defineRule({
  description:
    'A command or query keeps at most a few local helpers; more belong in application/services.',
  schema: [
    {
      type: 'object',
      properties: { max: { type: 'integer', minimum: 0 } },
      additionalProperties: false,
    },
  ],
  create(context) {
    const max = context.options[0]?.max ?? USE_CASE_HELPERS.max;
    const { file } = classifyContext(context);
    const isUseCase =
      file.area === 'module' &&
      file.layer === 'application' &&
      (file.dir === 'commands' || file.dir === 'queries');
    if (!isUseCase) return {};

    return {
      Program(program) {
        const helpers = functionsBesideClass(program).length + extraMethods(program).length;
        if (helpers > max) {
          report(
            context,
            program,
            `This ${file.dir === 'commands' ? 'command' : 'query'} has ${helpers} local helpers (at most ${max}). Move them into application/services, one file per job, and call them from here. See docs/rules/modules.md.`,
          );
        }
      },
    };
  },
});
