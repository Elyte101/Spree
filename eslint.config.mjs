import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Forbid dangerouslySetInnerHTML for user-controlled content.
      // The only legitimate callsite is themeRegistry.tsx (Emotion CSS injection)
      // which has an eslint-disable-next-line comment explaining why it is safe.
      "react/no-danger": "error",
    },
  },
]);

export default eslintConfig;
