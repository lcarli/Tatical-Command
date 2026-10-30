import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'coverage', 'playwright-report', 'test-results']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    files: ['*.{js,ts}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/simulation/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['react', 'react/**', 'react-dom', 'react-dom/**', 'phaser', 'phaser/**', 'node:*', '**/ui/**', '**/game/**', '**/app/**'],
          allowTypeImports: false,
          message: 'Keep simulation independent of UI, rendering, application and platform APIs.',
        }],
      }],
      'no-restricted-globals': ['error', 'window', 'document', 'performance', 'fetch', 'Date', 'setTimeout', 'setInterval', 'requestAnimationFrame'],
      'no-restricted-properties': ['error', {
        object: 'Math',
        property: 'random',
        message: 'Use an injected seeded PRNG in simulation.',
      }],
    },
  },
]);
