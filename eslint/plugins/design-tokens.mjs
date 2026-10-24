import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} filePath */
function isAllowedFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('app/globals.css')) return true;
  if (normalized.includes('/data/')) return true;
  if (/\.test\.(ts|tsx)$/.test(normalized)) return true;
  return false;
}

/**
 * @param {RegExp} pattern
 * @param {string} message
 * @returns {import("eslint").Rule.RuleModule}
 */
function makeClassRule(pattern, message) {
  /** @param {import("eslint").Rule.RuleContext} context */
  return {
    create(context) {
      if (isAllowedFile(context.filename ?? context.getFilename())) return {};

      /** @param {import("eslint").Rule.Node} node */
      function check(node) {
        const text = node.type === 'Literal' ? String(node.value) : (node.value?.cooked ?? '');
        const matches = [...text.matchAll(new RegExp(pattern.source, 'g'))];
        for (const m of matches) {
          context.report({
            node,
            message: `${message} (found: "${m[0]}")`,
          });
        }
      }

      return {
        JSXAttribute(node) {
          const name = node.name.name;
          if (name !== 'className' && name !== 'class') return;
          if (!node.value) return;
          if (node.value.type === 'Literal') check(node.value);
          if (node.value.type === 'JSXExpressionContainer') {
            const expr = node.value.expression;
            if (expr.type === 'TemplateLiteral') {
              expr.quasis.forEach(check);
            }
            if (expr.type === 'Literal') check(expr);
          }
        },
        // Also catch cn("...") or clsx("...") string arguments
        CallExpression(node) {
          const callee = node.callee;
          const isCn =
            (callee.type === 'Identifier' &&
              (callee.name === 'cn' || callee.name === 'clsx' || callee.name === 'cva')) ||
            (callee.type === 'MemberExpression' && callee.property.name === 'cva');
          if (!isCn) return;
          node.arguments.forEach((arg) => {
            if (arg.type === 'Literal') check(arg);
            if (arg.type === 'TemplateLiteral') arg.quasis.forEach(check);
          });
        },
      };
    },
    meta: {
      type: 'problem',
      docs: { description: message },
      schema: [],
    },
  };
}

const PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow|accent|decoration|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

const LITERAL_WHITE_BLACK_PATTERN =
  /\b(?:bg|text|border|ring|fill|stroke|divide|outline)-(?:white|black)\b/g;

function detectTokenPrefix(cwd = process.cwd()) {
  const cssPath = join(cwd, 'src', 'app', 'globals.css');
  if (existsSync(cssPath)) {
    try {
      const css = readFileSync(cssPath, 'utf8');
      const match = css.match(/--([a-z0-9]+)-color-/);
      if (match) return match[1];
    } catch {
      return 'theme';
    }
  }
  return 'theme';
}

const tokenPrefix = detectTokenPrefix();

const ARBITRARY_TOKEN_PATTERN = new RegExp(
  `[a-z-]+-\\[[^\\]]*var\\(--(?:${tokenPrefix})-(?:color|radius|section|font)[^\\]]*\\]`,
  'g',
);

const RAW_HEX_PATTERN = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g;

const RAW_COLOR_FN_PATTERN = /\b(?:rgba?|hsla?)\(/g;

const ARBITRARY_SIZE_PATTERN = /[a-z-]+-\[[0-9.]+(?:px|rem|em|vh|vw|dvh|svh|lvh|%|fr)[^\]]*\]/g;

const SCREEN_HEIGHT_PATTERN = /\b(?:min-h|h|max-h)-screen\b/g;

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-design-tokens',
    version: '1.0.0',
  },
  rules: {
    'no-raw-palette-color': makeClassRule(
      PALETTE_PATTERN,
      'Use a token instead of a Tailwind palette color (e.g. text-danger instead of text-red-700)',
    ),
    'no-literal-white-black': makeClassRule(
      LITERAL_WHITE_BLACK_PATTERN,
      'Use surface / copy tokens instead of raw white / black',
    ),
    'no-arbitrary-token': makeClassRule(
      ARBITRARY_TOKEN_PATTERN,
      `Use the registered utility instead of an arbitrary --${tokenPrefix}-* var()`,
    ),
    'no-raw-hex': makeClassRule(
      RAW_HEX_PATTERN,
      'Add a token in globals.css instead of a raw hex literal',
    ),
    'no-raw-color-fn': makeClassRule(
      RAW_COLOR_FN_PATTERN,
      'Derive from a token with color-mix() instead of rgb()/hsl()',
    ),
    'no-arbitrary-size': makeClassRule(
      ARBITRARY_SIZE_PATTERN,
      'Use a scale utility or add a token instead of an arbitrary px/rem/vh size',
    ),
    'no-screen-height': makeClassRule(
      SCREEN_HEIGHT_PATTERN,
      'Use dynamic viewport height (min-h-dvh) — h-screen overflows behind mobile browser toolbars',
    ),
  },
};

export default plugin;
