import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off"
    }
  },
  {
    ignores: [
      "**/*.js",
      "**/*.mjs",
      "node_modules/*",
      ".yarn/*"
    ]
  }
);