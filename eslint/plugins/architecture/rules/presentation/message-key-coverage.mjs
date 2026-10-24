import { classifyContext, defineRule, report } from '../../util.mjs';

const KEY = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+$/;

function stripWrappers(node) {
  let current = node;
  let satisfies = null;
  while (
    current &&
    (current.type === 'TSAsExpression' || current.type === 'TSSatisfiesExpression')
  ) {
    if (current.type === 'TSSatisfiesExpression') satisfies = current.typeAnnotation;
    current = current.expression;
  }
  return { value: current, satisfies };
}

/** `presentation/messages/message-keys.ts`: exhaustive code -> translation-key maps with a generic fallback. */
export const messageKeyCoverage = defineRule({
  description:
    'Message-key files map every code to a translation key with `satisfies Record<…>`, keep prose out, and provide a generic fallback.',
  create(context) {
    const { file } = classifyContext(context);
    const isFile =
      file.area === 'module' &&
      file.layer === 'presentation' &&
      file.dir === 'messages' &&
      file.file === 'message-keys.ts';
    if (!isFile) return {};
    const exported = new Map();
    let fallbackReferenced = false;

    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;
        if (declaration?.type === 'VariableDeclaration') {
          for (const d of declaration.declarations)
            if (d.id.type === 'Identifier') exported.set(d.id.name, d);
        }
        if (declaration?.type === 'FunctionDeclaration')
          exported.set(declaration.id.name, declaration);
      },
      Identifier(node) {
        if (node.name === 'GENERIC_ERROR_MESSAGE_KEY' && node.parent.type !== 'VariableDeclarator')
          fallbackReferenced = true;
      },
      'Program:exit'(program) {
        const map = exported.get('MESSAGE_KEY_BY_CODE');
        if (!map) {
          report(
            context,
            program,
            'Export `MESSAGE_KEY_BY_CODE`: every error and validation code maps to a translation key.',
          );
        }
        for (const [name, declarator] of exported) {
          if (declarator.type !== 'VariableDeclarator' || !declarator.init) continue;
          const { value, satisfies } = stripWrappers(declarator.init);
          if (value.type !== 'ObjectExpression') continue;
          const isKeyMap = name === 'MESSAGE_KEY_BY_CODE' || /_MESSAGE_KEYS$/.test(name);
          if (!isKeyMap) continue;
          if (!(satisfies?.type === 'TSTypeReference' && satisfies.typeName.name === 'Record')) {
            report(
              context,
              declarator.id,
              `\`${name}\` must end with \`as const satisfies Record<<Keys>, …>\` so a missing entry is a compile error, not a runtime fallback.`,
            );
          }
          for (const property of value.properties) {
            if (property.type !== 'Property') continue;
            const values =
              property.value.type === 'ObjectExpression'
                ? property.value.properties.map((p) => p.value)
                : [property.value];
            for (const v of values) {
              if (v.type === 'Literal' && typeof v.value === 'string' && !KEY.test(v.value)) {
                report(
                  context,
                  v,
                  `'${v.value}' is not a translation key. Map codes to dotted keys (e.g. 'errors.notFound'); the text lives in presentation/i18n/<locale>.json.`,
                );
              }
            }
          }
        }
        const generic = exported.get('GENERIC_ERROR_MESSAGE_KEY');
        if (!generic)
          report(
            context,
            program,
            'Export `GENERIC_ERROR_MESSAGE_KEY`, the translation key used for codes this module does not know.',
          );
        const lookup = exported.get('messageKeyForCode');
        if (!lookup)
          report(
            context,
            program,
            'Export `messageKeyForCode(code: string)` that returns GENERIC_ERROR_MESSAGE_KEY for unknown codes.',
          );
        else if (!fallbackReferenced)
          report(
            context,
            lookup.id ?? lookup,
            '`messageKeyForCode` must fall back to `GENERIC_ERROR_MESSAGE_KEY` for unknown codes (codes from other modules or from Zod).',
          );
      },
    };
  },
});
