import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const lintOptionDefinitions = {
    fix: {
        defaultValue: false,
        description: "Apply auto-fixes in place",
        type: Boolean,
    },
    format: {
        defaultValue: "human",
        description: "Output format: human, json, minimal, sarif, junit, or github",
        type: String,
    },
    "max-warnings": {
        description: "Fail the run if more than N warnings are reported",
        type: Number,
    },
    output: {
        description: "Write formatted output to a file path instead of stdout (also accepts `-`/`stdout`/`stderr`)",
        type: String,
    },
    quiet: {
        defaultValue: false,
        description: "Suppress warnings — report errors only",
        type: Boolean,
    },
    since: {
        description: "Only lint files changed vs the given git ref (branch, tag, sha)",
        type: String,
    },
    staged: {
        defaultValue: false,
        description: "Only lint files currently staged in the git index",
        type: Boolean,
    },
    watch: {
        defaultValue: false,
        description: "Re-run linters whenever watched files change",
        type: Boolean,
    },
} as const;

const lint = defineCommand({
    description: "Orchestrate detected source-code linters (eslint, …) across the workspace",
    examples: [
        ["vis lint", "Run every detected linter against the workspace"],
        ["vis lint --fix", "Apply auto-fixes where the tool supports them"],
        ["vis lint --format json", "Emit findings as JSON for CI / editor integrations"],
        ["vis lint --format sarif", "Emit a SARIF 2.1.0 document for code-scanning uploads"],
        ["vis lint --format junit", "Emit a JUnit XML report for CI dashboards"],
        ["vis lint --format github", "Emit GitHub Actions workflow commands for inline PR annotations"],
        ["vis lint src/foo.ts src/bar.ts", "Lint a specific file list"],
        ["vis lint --quiet", "Suppress warnings — only errors are reported"],
        ["vis lint --max-warnings 0", "Treat any warning as a failure"],
        ["vis lint --since main", "Only lint files changed vs the main branch"],
        ["vis lint --staged", "Only lint files currently staged in the git index"],
        ["vis lint --watch", "Re-run linters when watched files change (cache makes incremental near-free)"],
        ["vis lint --format sarif --output lint.sarif", "Write the SARIF report to lint.sarif instead of stdout"],
    ],
    group: "Lint & Format",
    loader: () => import("./handler"),
    name: "lint",
    options: lintOptionDefinitions,
});

export default lint;

export type LintOptions = InferOptions<typeof lintOptionDefinitions>;
