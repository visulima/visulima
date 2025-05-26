import { createConfig } from "@anolilab/eslint-config";

export default createConfig({
    ignores: ["dist", "node_modules", "coverage", "__fixtures__", "__docs__", "vitest.config.ts", ".prettierrc.cjs", "packem.config.ts", ".secretlintrc.cjs", "tsconfig.eslint.json", "package.json", "README.md"],
});