import type { Command, CreateOptions } from "@visulima/cerebro";

const lint: Command = {
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
    ],
    group: "Lint & Format",
    loader: () => import("./handler"),
    name: "lint",
    options: [
        { defaultValue: false, description: "Apply auto-fixes in place", name: "fix", type: Boolean },
        { defaultValue: "human", description: "Output format: human, json, minimal, sarif, junit, or github", name: "format", type: String },
        { defaultValue: false, description: "Suppress warnings — report errors only", name: "quiet", type: Boolean },
        { description: "Fail the run if more than N warnings are reported", name: "max-warnings", type: Number },
        { description: "Only lint files changed vs the given git ref (branch, tag, sha)", name: "since", type: String },
        { defaultValue: false, description: "Only lint files currently staged in the git index", name: "staged", type: Boolean },
        { defaultValue: false, description: "Re-run linters whenever watched files change", name: "watch", type: Boolean },
    ],
};

export default lint;

export type LintOptions = CreateOptions<{
    fix: boolean | undefined;
    format: "github" | "human" | "json" | "junit" | "minimal" | "sarif";
    "max-warnings": number | undefined;
    quiet: boolean | undefined;
    since: string | undefined;
    staged: boolean | undefined;
    watch: boolean | undefined;
}>;
