import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.ts',
      '**/*.config.mjs',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      // Browser globals are needed for the client (window, document,
      // AbortController, fetch, setTimeout as global). Node globals remain
      // for parser/server packages. Both namespaces are harmless where the
      // other isn't used.
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript's own checker covers undefined identifiers (and understands
      // type-only references like `JSX.Element` or `RequestInit`). eslint's
      // no-undef doesn't, so it produces false positives on every TS type —
      // defer to the TS compiler instead.
      'no-undef': 'off',
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
