import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  {
    ignores: [
      "out/**",
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "*.js",
      "esbuild.js"
    ]
  },
  {
    files: ["**/*.{ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // TypeScript específico
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Buenas prácticas
      "no-console": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],

      // Complejidad
      "max-lines-per-function": ["warn", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4]
    }
  },
  {
    files: ["src/test/**/*.ts"],
    rules: {
      // Relajar reglas para tests
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "max-lines-per-function": "off",
      "no-console": "off",
      "max-depth": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  {
    files: ["src/test/e2e/**/*.ts"],
    rules: {
      // Relajar aún más reglas para tests E2E
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "max-lines-per-function": "off",
      "no-console": "off",
      "max-depth": "off",
      "max-params": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  // Prettier debe ir al final para desactivar reglas de formato conflictivas
  eslintConfigPrettier
]);
