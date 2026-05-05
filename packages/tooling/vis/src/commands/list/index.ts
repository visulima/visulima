import type { Command, CreateOptions } from "@visulima/cerebro";

const list: Command = {
    description: "List all workspace projects with metadata",
    examples: [
        ["vis list", "Show all projects"],
        ["vis list --targets", "Per-target rows with type, cache status and description"],
        ["vis list --targets --inferred", "Only show targets synthesized by Project Crystal-style inference"],
        ["vis list --deps", "Human-readable table of every dep-instance across the workspace"],
        ["vis list --deps --internal-only", "Only workspace deps in human form"],
        ["vis list --deps --format=ndjson", "Stream every dep-instance as NDJSON for jq pipelines"],
        ["vis list --deps --format=json --pretty", "Single pretty-printed JSON array of dep-instances"],
        ["vis list --format=json", "Machine-readable project listing"],
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
            description: "Output format: table (default), json (single document), or ndjson (one record per line; --deps only)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Pretty-print with 2-space indent (only meaningful with --format=json)",
            name: "pretty",
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
        {
            defaultValue: false,
            description: "Render a dep-instance view (table by default; use --format=ndjson|json for jq-friendly streams)",
            name: "deps",
            type: Boolean,
        },
        {
            description: "Restrict --deps to specific dep blocks (repeatable)",
            multiple: true,
            name: "dep-type",
            type: String,
        },
        {
            defaultValue: false,
            description: "With --deps: only show internal/workspace deps",
            name: "internal-only",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "With --deps: only show external/registry deps",
            name: "external-only",
            type: Boolean,
        },
        {
            description: "With --deps: glob of declaring package names to keep (repeatable)",
            multiple: true,
            name: "include",
            type: String,
        },
        {
            description: "With --deps: glob of declaring package names to drop (repeatable)",
            multiple: true,
            name: "exclude",
            type: String,
        },
    ],
};

export default list;

export type ListOptions = CreateOptions<{
    "dep-type": string[] | undefined;
    deps: boolean | undefined;
    exclude: string[] | undefined;
    "external-only": boolean | undefined;
    format: string | undefined;
    include: string[] | undefined;
    inferred: boolean | undefined;
    "internal-only": boolean | undefined;
    pretty: boolean | undefined;
    query: string | undefined;
    targets: boolean | undefined;
}>;
