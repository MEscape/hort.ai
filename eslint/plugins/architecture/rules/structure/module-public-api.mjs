import { classifyContext, defineRule, report } from '../../util.mjs';

const INTERNAL_NAME =
  /(?:Repository|RecordMapper|Mapper)$|^(?:Prisma|Logger)[A-Z]|^create\w*ErrorBag$|_SELECT$|^(?:SELECT|select)[A-Z_]/;

/** `index.ts` is the module's public API: explicit names, no internals. */
export const modulePublicApi = defineRule({
  description:
    "A module's index.ts re-exports explicit, intentional names only: no `export *`, no default export, no repositories, mappers, adapters or error factories.",
  create(context) {
    const { file } = classifyContext(context);
    if (!(file.area === 'module' && file.layer === 'root' && file.file === 'index.ts')) return {};
    return {
      ExportAllDeclaration(node) {
        report(
          context,
          node,
          'Avoid `export *` in a module public API. Re-export explicit names so the public surface is a decision, not an accident.',
        );
      },
      ExportDefaultDeclaration(node) {
        report(context, node, 'A module public API uses named exports.');
      },
      ExportNamedDeclaration(node) {
        for (const specifier of node.specifiers) {
          const exportedName = specifier.exported.name ?? specifier.exported.value;
          if (
            INTERNAL_NAME.test(exportedName) &&
            specifier.exportKind !== 'type' &&
            node.exportKind !== 'type'
          ) {
            report(
              context,
              specifier,
              `\`${exportedName}\` looks like an implementation detail (repository, mapper, adapter or error factory). Keep it internal; expose a use-case function, component, route helper or contract type instead.`,
            );
          }
        }
        const declaration = node.declaration;
        if (declaration) {
          report(
            context,
            node,
            'index.ts only re-exports; declare things in their own layer and re-export them by name.',
          );
        }
      },
    };
  },
});
