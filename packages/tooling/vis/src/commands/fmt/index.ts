import type { Command, CreateOptions } from "@visulima/cerebro";

const fmt: Command = {
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
    ],
    group: "Lint & Format",
    loader: () => import("./handler"),
    name: "fmt",
    options: [
        { defaultValue: false, description: "Report files that would change without writing", name: "check", type: Boolean },
        { defaultValue: "human", description: "Output format: human, json, minimal, sarif, junit, or github", name: "format", type: String },
        { defaultValue: false, description: "Suppress per-file logs", name: "quiet", type: Boolean },
        { description: "Only format files changed vs the given git ref (branch, tag, sha)", name: "since", type: String },
        { defaultValue: false, description: "Only format files currently staged in the git index", name: "staged", type: Boolean },
    ],
};

export default fmt;

export type FmtOptions = CreateOptions<{
    check: boolean | undefined;
    format: "github" | "human" | "json" | "junit" | "minimal" | "sarif";
    quiet: boolean | undefined;
    since: string | undefined;
    staged: boolean | undefined;
}>;
