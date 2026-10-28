import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'coverage',
    'dist',
    'dist-desktop',
    'src-tauri/target',
    'src-tauri/gen',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // The classic hook rules; the React Compiler rules assume code written for the compiler.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**', '*.config.{js,ts}', '.pnpmfile.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Mocks and polyfills stand in for browser and Chrome objects.
    files: ['test/**', 'src/**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
