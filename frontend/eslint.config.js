import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly'
}

export default tseslint.config(
  // Static design comps (mockup HTML + its browser support.js) are reference
  // material, not app source — they are not built or imported, so don't lint them.
  { ignores: ['dist/', 'backend/', 'node_modules/', 'public/', 'design/'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: { module: 'readonly', require: 'readonly', __dirname: 'readonly' }
    }
  },

  // Node utility scripts (e.g. the cover-title OCR detector) run under Node, not the browser.
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: nodeGlobals
    }
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-undef': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      // Intentional imperative ref patterns in animation code (e.g. syncing a
      // velocity ref every render) — flag as advisory, not a build failure.
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
)
