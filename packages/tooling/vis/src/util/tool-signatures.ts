/**
 * Single source of truth for "how do we recognize tool X in a repo?"
 *
 * Both the Crystal-style target inference (`src/inference/detectors/*`)
 * and the lint+fmt orchestrator (`src/lint-fmt/adapters/*`) need the
 * same answer to two questions for each tool:
 *
 *   1. Which config files identify it? (e.g. `eslint.config.js`)
 *   2. Which `package.json` dep declaration identifies it? (e.g. `eslint`)
 *
 * Keeping these in one table prevents the two subsystems from drifting
 * apart — a new prettier config variant added here surfaces in both
 * Crystal's `format:check` inference and the orchestrator's prettier
 * adapter. Adapters and detectors are free to layer extra logic on
 * top (priority, output parsing, etc.); the signature is just the
 * detection primitive.
 *
 * `packageNames` is an array because some tools ship under multiple
 * names (e.g. `@biomejs/biome` and the deprecated `biome`); the first
 * entry is the canonical one used for telemetry/labelling.
 */

export interface ToolSignature {
    readonly configFiles: ReadonlyArray<string>;
    readonly packageNames: ReadonlyArray<string>;
}

export const TOOL_SIGNATURES = {
    biome: {
        configFiles: ["biome.json", "biome.jsonc"],
        packageNames: ["@biomejs/biome"],
    },
    deno: {
        // No npm package — Deno is a runtime. Detection is purely
        // config-based via `deno.json` / `deno.jsonc`.
        configFiles: ["deno.json", "deno.jsonc"],
        packageNames: [],
    },
    dprint: {
        configFiles: ["dprint.json", "dprint.jsonc", ".dprint.json", ".dprint.jsonc"],
        packageNames: ["dprint"],
    },
    eslint: {
        configFiles: [
            "eslint.config.js",
            "eslint.config.mjs",
            "eslint.config.cjs",
            "eslint.config.ts",
            "eslint.config.mts",
            ".eslintrc",
            ".eslintrc.js",
            ".eslintrc.cjs",
            ".eslintrc.json",
            ".eslintrc.yaml",
            ".eslintrc.yml",
        ],
        packageNames: ["eslint"],
    },
    oxfmt: {
        configFiles: [
            ".oxfmtrc",
            ".oxfmtrc.json",
            ".oxfmtrc.jsonc",
            ".oxfmtrc.ts",
            ".oxfmtrc.mts",
            ".oxfmtrc.cts",
            ".oxfmtrc.js",
            ".oxfmtrc.mjs",
            ".oxfmtrc.cjs",
            "oxfmt.config.ts",
            "oxfmt.config.mts",
            "oxfmt.config.js",
            "oxfmt.config.mjs",
        ],
        packageNames: ["oxfmt"],
    },
    oxlint: {
        configFiles: [".oxlintrc.json", ".oxlintrc.jsonc", "oxlint.json", "oxlint.jsonc"],
        packageNames: ["oxlint"],
    },
    prettier: {
        configFiles: [
            "prettier.config.ts",
            "prettier.config.js",
            "prettier.config.mjs",
            "prettier.config.mts",
            "prettier.config.cjs",
            ".prettierrc",
            ".prettierrc.json",
            ".prettierrc.js",
            ".prettierrc.cjs",
            ".prettierrc.mjs",
            ".prettierrc.ts",
            ".prettierrc.yml",
            ".prettierrc.yaml",
        ],
        packageNames: ["prettier"],
    },
    stylelint: {
        configFiles: [
            "stylelint.config.ts",
            "stylelint.config.js",
            "stylelint.config.mjs",
            "stylelint.config.cjs",
            ".stylelintrc",
            ".stylelintrc.json",
            ".stylelintrc.js",
            ".stylelintrc.cjs",
            ".stylelintrc.yml",
            ".stylelintrc.yaml",
        ],
        packageNames: ["stylelint"],
    },
} as const satisfies Record<string, ToolSignature>;

export type ToolSignatureKey = keyof typeof TOOL_SIGNATURES;
