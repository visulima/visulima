import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const listOptionDefinitions = {
    "dep-type": {
        description: "Restrict --deps to specific dep blocks (repeatable)",
        multiple: true,
        type: String,
    },
    deps: {
        defaultValue: false,
        description: "Render a dep-instance view (table by default; use --format=ndjson|json for jq-friendly streams)",
        type: Boolean,
    },
    exclude: {
        description: "With --deps: glob of declaring package names to drop (repeatable)",
        multiple: true,
        type: String,
    },
    "external-only": {
        defaultValue: false,
        description: "With --deps: only show external/registry deps",
        type: Boolean,
    },
    format: {
        description: "Output format: table (default), json (single document), or ndjson (one record per line; --deps only)",
        type: String,
    },
    include: {
        description: "With --deps: glob of declaring package names to keep (repeatable)",
        multiple: true,
        type: String,
    },
    inferred: {
        defaultValue: false,
        description: "Filter target rows to only inferred targets (implies --targets)",
        type: Boolean,
    },
    "internal-only": {
        defaultValue: false,
        description: "With --deps: only show internal/workspace deps",
        type: Boolean,
    },
    pretty: {
        defaultValue: false,
        description: "Pretty-print with 2-space indent (only meaningful with --format=json)",
        type: Boolean,
    },
    query: {
        description: "Filter projects by query",
        type: String,
    },
    tag: {
        description: "Only list projects carrying one of these tags (repeatable, or comma-separated). Shorthand for --query=\"tag=…\".",
        multiple: true,
        type: String,
    },
    targets: {
        defaultValue: false,
        description: "Show per-target rows (type, cache, description)",
        type: Boolean,
    },
} as const;

const list = defineCommand({
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
        ["vis list --tag=type:package", "Filter by tag (shorthand for the query above)"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "list",
    options: listOptionDefinitions,
});

export default list;

export type ListOptions = InferOptions<typeof listOptionDefinitions>;
