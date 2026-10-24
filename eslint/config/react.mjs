import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Our shared primitives, so jsx-a11y checks them like the element they
 * render (an icon-only <Button> needs a name just like a <button>).
 */
const A11Y_COMPONENTS = {
  Button: 'button',
  // Radix's trigger is `<button role="combobox">`: it supports aria-invalid like a <select>.
  SelectTrigger: 'select',
  Input: 'input',
  Textarea: 'textarea',
  Label: 'label',
  Link: 'a',
  ContentLink: 'a',
  Image: 'img',
};

/** React, Hooks, JSX accessibility (strict) and Next.js (core-web-vitals). */
export const react = [
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: {
      react: { version: 'detect' },
      // Our locale-aware Link renders an <a>: apply the rel=noopener checks to it too.
      // (eslint-plugin-react reads these shared settings at the top level of `settings`.)
      linkComponents: [{ name: 'Link', linkAttribute: 'href' }],
      'jsx-a11y': { components: A11Y_COMPONENTS },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.strict.rules,

      'react/prop-types': 'off', // TypeScript handles this
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/self-closing-comp': 'error',
      'react/jsx-curly-brace-presence': ['error', 'never'],
      'react/no-array-index-key': 'warn',
      // Raw HTML injection and unsafe link/URL patterns.
      'react/no-danger': 'error',
      'react/jsx-no-target-blank': [
        'error',
        { enforceDynamicLinks: 'always', links: true, forms: true },
      ],
      'react/jsx-no-script-url': 'error',
      // docs/rules/i18n.md: text in JSX comes from the catalog. Symbols that read the same in every language are allowed.
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: false,
          ignoreProps: true,
          allowedStrings: [
            '·',
            '→',
            '—',
            '–',
            '…',
            '/',
            '|',
            '(',
            ')',
            ':',
            '%',
            '×',
            '+',
            '-',
            '*',
            '#',
          ],
        },
      ],
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',

      // Accessibility is part of the definition of done (it is not proven by lint:
      // keyboard flow, screen-reader output and contrast need runtime checks).
      'jsx-a11y/anchor-is-valid': [
        'error',
        {
          components: ['Link', 'ContentLink'],
          specialLink: ['hrefLeft', 'hrefRight'],
          aspects: ['invalidHref', 'preferButton'],
        },
      ],
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/media-has-caption': 'error',
      'jsx-a11y/alt-text': [
        'error',
        { elements: ['img', 'object', 'area', 'input[type="image"]'], img: ['Image'] },
      ],
      'jsx-a11y/control-has-associated-label': [
        'error',
        {
          labelAttributes: ['aria-label', 'aria-labelledby', 'title'],
          controlComponents: ['Button', 'SelectTrigger', 'Link', 'ContentLink'],
          ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'],
          ignoreRoles: [
            'grid',
            'listbox',
            'menu',
            'menubar',
            'radiogroup',
            'row',
            'tablist',
            'toolbar',
            'tree',
            'treegrid',
          ],
          depth: 3,
        },
      ],
      'jsx-a11y/label-has-associated-control': [
        'error',
        {
          labelComponents: ['Label'],
          controlComponents: ['Input', 'SelectTrigger'],
          assert: 'either',
          depth: 6,
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': /** @type {any} */ (nextPlugin) },
    rules: /** @type {any} */ ({
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // App Router only: this rule inspects a Pages Router `pages/` directory (and prints a warning on every
      // run when there is none). Raw <a> elements are already rejected by the UI-primitive restriction.
      '@next/next/no-html-link-for-pages': 'off',
    }),
  },
  // Primitive wrappers implement the elements everyone else must not use raw.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/heading-has-content': 'off',
      '@next/next/no-img-element': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/control-has-associated-label': 'off',
      'react/no-array-index-key': 'off',
    },
  },
];
