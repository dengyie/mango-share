// ESLint flat config. Layering:
// - tsc (`npm run build`) remains the full type gate; typescript-eslint here
//   is the non-type-checked recommended set for CI speed.
// - react-hooks: exhaustive-deps and rules-of-hooks are hard errors (both
//   caught real staleness/bug risks in this repo). The React-compiler-era
//   rules set-state-in-effect / refs flag idiomatic patterns this codebase
//   uses deliberately (latest-ref params, effect initialization) — warn
//   only, so the gate stays meaningful without a risky rewrite.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/', 'blog/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Deliberate idioms (see header): latest-ref params, effect init.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/globals': 'warn',
      // Hooks need real types; don't re-lint what tsc already enforces.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // audited usage only
    },
  },
  {
    // Hand-rolled hook test harnesses: render() calls hooks outside a
    // real renderer and reads window/localStorage by design.
    files: ['src/hooks/*.test.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  }
);
