import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// Workaround for ESLint 10 incompatibilities in eslint-config-next's transitive
// deps (upstream: jsx-eslint/eslint-plugin-react#3977, vercel/next.js#89764).
// Remove these blocks once eslint-config-next ships ESLint 10-compatible plugins.
import tsParser from "@typescript-eslint/parser";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react's "detect" path calls context.getFilename(), which
    // ESLint 10 removed; pinning the version skips that branch.
    settings: { react: { version: "19.3.0" } },
  },
  {
    // Next's vendored Babel 7 parser lacks ScopeManager#addGlobals (ESLint 10);
    // typescript-eslint's parser implements it.
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: { parser: tsParser },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
