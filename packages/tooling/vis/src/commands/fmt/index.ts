import type { Command, CreateOptions } from "@visulima/cerebro";

const fmt: Command = {
    description: "Orchestrate detected formatters (prettier, …) across the workspace",
    examples: [
        ["vis fmt", "Apply formatting in place using every detected formatter"],
        ["vis fmt --check", "Report files that would change without writing"],
        ["vis fmt --format json", "Emit findings as JSON for CI / editor integrations"],
        ["vis fmt src/foo.ts src/bar.ts", "Format a specific file list"],
        ["vis fmt --quiet", "Suppress per-file logs"],
    ],
    group: "Lint & Format",
    loader: () => import("./handler"),
    name: "fmt",
    options: [
        { defaultValue: false, description: "Report files that would change without writing", name: "check", type: Boolean },
        { defaultValue: "human", description: "Output format: human, json, or minimal", name: "format", type: String },
        { defaultValue: false, description: "Suppress per-file logs", name: "quiet", type: Boolean },
    ],
};

export default fmt;

export type FmtOptions = CreateOptions<{
    check: boolean | undefined;
    format: "human" | "json" | "minimal";
    quiet: boolean | undefined;
}>;
