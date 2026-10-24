import { UI_COMPOSITION, uiCompositionScope } from '../../../../policy/policy.mjs';
import { classifyContext, defineRule, report } from '../../util.mjs';

const TAG = /@ui-plain\s+([\w-]+)\s+\S/g;

/** The names a file has waived with `@ui-plain <name> <reason>`. */
function waivedNames(context) {
  const names = new Set();
  for (const comment of context.sourceCode.getAllComments()) {
    for (const match of comment.value.matchAll(TAG)) names.add(match[1]);
  }
  return names;
}

/** `<input type="hidden">` carries state to the server; it draws nothing, so there is no component for it. */
const isHiddenInput = (node) =>
  node.name.name === 'input' &&
  node.attributes.some(
    (attribute) =>
      attribute.type === 'JSXAttribute' &&
      attribute.name.name === 'type' &&
      attribute.value?.value === 'hidden',
  );

/**
 * The design system is used where it fits, and plain markup is a choice that is written down. A raw element
 * that has a component (`<button>` for `Button`, `<table>` for `Table`), or a primitive used without the composite
 * that frames it (a `Table` without a `DataPanel`), is reported unless the file says why with
 * `// @ui-plain <name> <reason>`. The reason is the point: it keeps the choice visible in review, so a screen is
 * plain on purpose and never by accident. What each name asks for is listed in `UI_COMPOSITION`.
 */
export const uiComposition = defineRule({
  description:
    'Use components/ui and components/shared where they fit; plain markup or a primitive without its composite needs `@ui-plain <name> <reason>`.',
  create(context) {
    const { file } = classifyContext(context);
    if (!context.filename.endsWith('.tsx') || !uiCompositionScope(file)) return {};

    const waived = waivedNames(context);
    const imported = new Set();
    const used = [];

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        imported.add(node.source.value);
        for (const pair of UI_COMPOSITION.pairs) {
          if (node.source.value === pair.source) used.push({ pair, node });
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const element = node.name.name;
        const plain = UI_COMPOSITION.plain[element];
        if (plain === undefined || waived.has(element) || isHiddenInput(node)) return;
        report(
          context,
          node,
          `Use ${plain.use} instead of a raw <${element}>${plain.why === undefined ? '' : ` (${plain.why})`}. If plain markup is right here, say why: // @ui-plain ${element} <reason>`,
        );
      },
      'Program:exit'() {
        for (const { pair, node } of used) {
          if (waived.has(pair.name) || imported.has(pair.needs)) continue;
          report(
            context,
            node,
            `${pair.hint} Use it here, or say why not: // @ui-plain ${pair.name} <reason>`,
          );
        }
      },
    };
  },
});
