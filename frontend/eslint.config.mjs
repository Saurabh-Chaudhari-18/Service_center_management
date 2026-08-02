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
    // One-off Node script (CommonJS); not part of the Next app bundle.
    "replace_colors.js",
  ]),
  {
    files: ["src/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/lib/api/services.ts"],
    rules: {
      // Large generated-style API surface; tighten types incrementally.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // react-hook-form `watch()` is flagged; prefer `useWatch` when refactoring.
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    files: ["src/components/ui/index.tsx", "src/components/CommandPalette/index.tsx"],
    rules: {
      // Hydration / list-focus resets; refactors tracked separately.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
