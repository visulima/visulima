import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const fmtOptionDefinitions = {
    check: {
        defaultValue: false,
        description: "Report files that would change without writing",
        type: Boolean,
    },
    format: {
        defaultValue: "human",
        description: "Output format: human, json, minimal, sarif, junit, or github",
        type: String,
    },
    output: {
        description: "Write formatted output to a file path instead of stdout (also accepts `-`/`stdout`/`stderr`)",
        type: String,
    },
    quiet: {
        defaultValue: false,
        description: "Suppress per-file logs",
        type: Boolean,
    },
    since: {
        description: "Only format files changed vs the given git ref (branch, tag, sha)",
        type: String,
    },
    staged: {
        defaultValue: false,
        description: "Only format files currently staged in the git index",
        type: Boolean,
    },
    watch: {
        defaultValue: false,
        description: "Re-run formatters whenever watched files change",
        type: Boolean,
    },
} as const;

const fmt = defineCommand({
    description: "Orchestrate detected formatters (prettier, …) across the workspace",
    examples: [
        ["vis fmt", "Apply formatting in place using every detected formatter"],
        ["vis fmt --check", "Report files that would change without writing"],
        ["vis fmt --check --format json", "Emit findings as JSON for CI / editor integrations"],
        ["vis fmt --check --format sarif", "Emit a SARIF 2.1.0 document for code-scanning uploads"],
        ["vis fmt --check --format junit", "Emit a JUnit XML report for CI dashboards"],
        ["vis fmt --check --format github", "Emit GitHub Actions workflow commands for inline PR annotations"],
        ["vis fmt src/foo.ts src/bar.ts", "Format a specific file list"],
        ["vis fmt --quiet", "Suppress per-file logs"],
        ["vis fmt --since main", "Only format files changed vs the main branch"],
        ["vis fmt --staged", "Only format files currently staged in the git index"],
        ["vis fmt --watch", "Re-run formatters when watched files change (cache makes incremental --check near-free)"],
        ["vis fmt --check --format sarif --output fmt.sarif", "Write the SARIF report to fmt.sarif instead of stdout"],
    ],
    group: "Lint & Format",
    loader: () => import("./handler"),
    name: "fmt",
    options: fmtOptionDefinitions,
});

export default fmt;

export type FmtOptions = InferOptions<typeof fmtOptionDefinitions>;
