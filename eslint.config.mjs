import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Type shapes are always declared with `type` aliases in this repo.
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Use the @/ (src), @public/, or @generated/ import alias instead of parent-relative paths.",
            },
          ],
        },
      ],
    },
  },
  // Disable ESLint rules that conflict with Prettier (Prettier owns formatting).
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "generated/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
