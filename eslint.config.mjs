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
    // Reference implementation + media fixtures — not part of the app bundle.
    "demo/**",
    "examples/**",
  ]),
  {
    // The ported demo deliberately uses `any` at the rtmlib-ts result
    // boundaries (the published d.ts collapses the rtmw3d/instanthmr union).
    files: ["components/playground/demo-app.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
