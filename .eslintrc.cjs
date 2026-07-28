/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    mocha: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json"
  },
  plugins: ["@typescript-eslint", "wdio"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:wdio/recommended",
    "prettier"
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "prefer-const": "error",
    eqeqeq: ["error", "always"]
  },
  ignorePatterns: ["node_modules/", "dist/", "reports/", "logs/", "*.cjs"]
}
