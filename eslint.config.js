import js from "@eslint/js";
import react from "@eslint-react/eslint-plugin";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

const sourceFiles = ["**/*.{js,jsx,mjs}"];
const browserFiles = ["src/**/*.{js,jsx}"];
const nodeFiles = [
  "*.config.{js,mjs}",
  "e2e/**/*.js",
  "scripts/**/*.js",
  "server/**/*.js",
];

export default [
  {
    ignores: [
      ".audit/**",
      ".design-audit/**",
      ".prototype-bootstrap/**",
      "android/**",
      "dist/**",
      "ios/**",
      "node_modules/**",
      "playwright-report/**",
      "public/**",
      "src/media-qa.jsx",
      "test-results/**",
      "tmp/**",
    ],
  },
  {
    files: sourceFiles,
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },
  {
    files: browserFiles,
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      "react/dom-no-unknown-property": "error",
      "react/no-missing-key": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["e2e/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-empty-pattern": ["error", {
        allowObjectPatternsAsParameters: true,
      }],
    },
  },
];
