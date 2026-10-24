import { defineRule, report } from '../../util.mjs';

/** Approximates "no skipped heading levels" within one file (headings in source order). */
export const headingHierarchy = defineRule({
  description:
    'Within one JSX file, heading levels must not skip (h2 → h4) and a file declares at most one h1.',
  create(context) {
    let previous = null;
    let h1Count = 0;
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !/^h[1-6]$/.test(node.name.name)) return;
        const level = Number(node.name.name[1]);
        if (level === 1) {
          h1Count += 1;
          if (h1Count > 1) report(context, node, 'A page has one <h1>. Use <h2> for sections.');
        }
        if (previous !== null && level > previous + 1) {
          report(
            context,
            node,
            `Heading level jumps from h${previous} to h${level}. Do not skip levels; screen-reader users navigate by the outline.`,
          );
        }
        previous = level;
      },
    };
  },
});
