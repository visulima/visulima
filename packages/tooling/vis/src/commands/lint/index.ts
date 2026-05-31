import type { Command, CreateOptions } from "@visulima/cerebro";

const lint: Command = {
    description: "Orchestrate detected source-code linters (eslint, …) across the workspace",
    examples: [
        ["vis lint", "Run every detected linter against the workspace"],
        ["vis lint --fix", "Apply auto-fixes where the tool supports them"],
        ["vis lint --format json", "Emit findings as JSON for CI / editor integrations"],
        ["vis lint --format sarif", "Emit a SARIF 2.1.0 document for code-scanning uploads"],
        ["vis lint --format junit", "Emit a JUnit XML report for CI dashboards"],
        ["vis lint src/foo.ts src/bar.ts", "Lint a specific file list"],
        ["vis lint --quiet", "Suppress warnings — only errors are reported"],
        ["vis lint --max-warnings 0", "Treat any warning as a failure"],
        ["vis lint --since main", "Only lint files changed vs the main branch"],
    ],
    group: "Lint & Format",
    loader: () => import("./handler"),
    name: "lint",
    options: [
        { defaultValue: false, description: "Apply auto-fixes in place", name: "fix", type: Boolean },
        { defaultValue: "human", description: "Output format: human, json, minimal, sarif, or junit", name: "format", type: String },
        { defaultValue: false, description: "Suppress warnings — report errors only", name: "quiet", type: Boolean },
        { description: "Fail the run if more than N warnings are reported", name: "max-warnings", type: Number },
        { description: "Only lint files changed vs the given git ref (branch, tag, sha)", name: "since", type: String },
    ],
};

export default lint;

export type LintOptions = CreateOptions<{
    fix: boolean | undefined;
    format: "human" | "json" | "junit" | "minimal" | "sarif";
    "max-warnings": number | undefined;
    quiet: boolean | undefined;
    since: string | undefined;
}>;
