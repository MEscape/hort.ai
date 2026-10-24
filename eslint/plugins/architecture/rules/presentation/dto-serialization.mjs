import { classifyContext, defineRule, report } from '../../util.mjs';

const DATE_FORMATTERS = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toJSON',
  'toUTCString',
  'toDateString',
  'toTimeString',
  'getTime',
]);

function containsDateType(node) {
  let found = null;
  const visit = (n) => {
    if (!n || typeof n.type !== 'string' || found) return;
    if (
      n.type === 'TSTypeReference' &&
      n.typeName.type === 'Identifier' &&
      n.typeName.name === 'Date'
    )
      found = n;
    for (const key of Object.keys(n)) {
      if (key === 'parent') continue;
      const child = n[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === 'string') visit(child);
    }
  };
  visit(node);
  return found;
}

/** DTOs are JSON-safe, explicit and limited to what consumers need. */
export const dtoSerialization = defineRule({
  description:
    'DTO files: JSON-safe types (no Date), explicit to<Name>Dto mappers, ISO-8601 via toISOString(), no object spreads.',
  create(context) {
    const { file } = classifyContext(context);
    const isDto =
      file.area === 'module' &&
      file.layer === 'presentation' &&
      file.dir === 'dto' &&
      file.rest.length === 2;
    if (!isDto) return {};
    const dtoTypes = new Map();
    const mappers = new Set();
    let derivesFromViews = false;

    return {
      ImportDeclaration(node) {
        // A DTO derived from an application view needs a mapper; one assembled inline by an action does not.
        if (
          /application\/contracts\//.test(node.source.value) &&
          node.specifiers.some(
            (s) => s.type === 'ImportSpecifier' && /View$/.test(s.imported.name ?? ''),
          )
        ) {
          derivesFromViews = true;
        }
      },
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;
        if (!declaration) return;
        if (
          declaration.type === 'TSInterfaceDeclaration' ||
          declaration.type === 'TSTypeAliasDeclaration'
        ) {
          if (/Dto$/.test(declaration.id.name)) dtoTypes.set(declaration.id.name, declaration.id);
          const date = containsDateType(declaration);
          if (date)
            report(
              context,
              date,
              `\`${declaration.id.name}\` contains a \`Date\`. Serialised DTOs carry dates as ISO-8601 strings (\`string\`), produced with \`toISOString()\`.`,
            );
        }
        if (declaration.type === 'FunctionDeclaration') {
          mappers.add(declaration.id.name);
          if (/^to[A-Z]\w*Dto$/.test(declaration.id.name) && !declaration.returnType) {
            report(
              context,
              declaration.id,
              `Annotate the return type of \`${declaration.id.name}\` with its DTO so the compiler checks every field.`,
            );
          }
        }
      },
      ObjectExpression(node) {
        const fn = findMapper(node);
        if (fn === null) return;
        for (const property of node.properties) {
          // Composing a DTO from another DTO (`...toPageSummaryDto(view)`) is safe: that mapper already chose its fields.
          const spreadsDto =
            property.type === 'SpreadElement' &&
            property.argument.type === 'CallExpression' &&
            property.argument.callee.type === 'Identifier' &&
            /^to[A-Z]\w*Dto$/.test(property.argument.callee.name);
          if (property.type === 'SpreadElement' && !spreadsDto) {
            report(
              context,
              property,
              'Do not spread a view/record into a DTO: any field added to it later would leak to clients. List the DTO fields explicitly.',
            );
          }
        }
      },
      CallExpression(node) {
        if (findMapper(node) === null) return;
        if (
          node.callee.type === 'MemberExpression' &&
          DATE_FORMATTERS.has(node.callee.property.name)
        ) {
          report(
            context,
            node,
            `Serialise dates with \`toISOString()\` (stable, locale-independent), not \`${node.callee.property.name}()\`. Formatting for display is a presentation concern.`,
          );
        }
      },
      NewExpression(node) {
        if (
          findMapper(node) !== null &&
          node.callee.type === 'Identifier' &&
          node.callee.name === 'Date'
        ) {
          report(context, node, 'A DTO mapper serialises existing dates; it does not create them.');
        }
      },
      'Program:exit'() {
        if (!derivesFromViews) return;
        for (const [name, id] of dtoTypes) {
          const expected = `to${name}`;
          if (!mappers.has(expected)) {
            report(
              context,
              id,
              `\`${name}\` needs an exported mapper \`${expected}(view): ${name}\` in the same file; DTOs are only built through explicit mapping functions.`,
            );
          }
        }
      },
    };

    function findMapper(node) {
      for (let current = node.parent; current; current = current.parent) {
        if (
          current.type === 'FunctionDeclaration' &&
          /^to[A-Z]\w*Dto$/.test(current.id?.name ?? '')
        )
          return current;
      }
      return null;
    }
  },
});
