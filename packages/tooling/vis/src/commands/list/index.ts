import type { Command, CreateOptions } from "@visulima/cerebro";

const list: Command = {
    description: "List all workspace projects with metadata",
    examples: [
        ["vis list", "Show all projects"],
        ["vis list --targets", "Per-target rows with type, cache status and description"],
        ["vis list --targets --inferred", "Only show targets synthesized by Project Crystal-style inference"],
        ["vis list --json", "Machine-readable output"],
        ["vis list --query \"tag=frontend\"", "Filter by query"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "list",
    options: [
        {
            defaultValue: false,
            description: "Filter target rows to only inferred targets (implies --targets)",
            name: "inferred",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Emit JSON instead of a table",
            name: "json",
            type: Boolean,
        },
        {
            description: "Filter projects by query",
            name: "query",
            type: String,
        },
        {
            defaultValue: false,
            description: "Show per-target rows (type, cache, description)",
            name: "targets",
            type: Boolean,
        },
    ],
};

export default list;

export type ListOptions = CreateOptions<{
    inferred: boolean | undefined;
    json: boolean | undefined;
    query: string | undefined;
    targets: boolean | undefined;
}>;
