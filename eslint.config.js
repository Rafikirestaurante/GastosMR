import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

const reglasComunes = {
  "no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrors: "none",
      ignoreRestSiblings: true
    }
  ],
  "no-console": "off",
  "no-useless-escape": "warn"
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    rules: {
      ...reglasComunes,
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error"
    }
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: reglasComunes
  }
];
