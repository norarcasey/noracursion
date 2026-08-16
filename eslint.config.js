import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // No type casting: `x as Foo` / `<Foo>x` defeat the type checker. Use a
      // type annotation or a runtime narrowing check instead. `as const` is
      // still allowed — it tightens types rather than overriding them.
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      // No non-null assertions either: `x!` hides the same nulls the type
      // checker is trying to surface. Narrow with a real runtime check instead.
      '@typescript-eslint/no-non-null-assertion': 'error',
      // CLAUDE.md §8: no eval, ever. The interpreter exists precisely so this
      // package runs under a CSP that forbids `unsafe-eval`; make that a lint
      // failure rather than a code-review question.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  // Vitest provides describe/it/expect etc. as globals via vite.config test setup.
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Node scripts run outside the browser.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // eslint-config-prettier must come last so it can switch off stylistic rules
  // that would otherwise conflict with Prettier's formatting.
  prettier,
)
