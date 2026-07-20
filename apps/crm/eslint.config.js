// ESLint config para o CRM (React 18 + Vite).
// Objetivo: pegar erros comuns e problemas de hooks, sem impor formatação
// (prettier-config desabilita regras estilísticas conflitantes).
// Rodar: npm run lint
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        Image: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        Uint8Array: 'readonly',
      },
    },
    settings: {
      react: { version: '18' },
    },
    rules: {
      // React
      'react/jsx-uses-react': 'off',              // React 18 (new JSX transform)
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',                  // sem prop-types no projeto
      'react/jsx-uses-vars': 'error',
      // Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Base
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];
