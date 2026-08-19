import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

/**
 * `vis action-graph &lt;selector>` — shows the execution plan that would
 * be produced by `vis run &lt;selector>` without running anything. Matches
 * moon's `moon action-graph`.
 */
const actionGraphOptionDefinitions = {
    json: {
        defaultValue: false,
        description: "Emit JSON instead of ASCII",
        type: Boolean,
    },
    projects: {
        alias: "p",
        description: "Comma-separated list of projects to plan (same semantics as `vis run --projects`)",
        type: String,
    },
    query: {
        description: "Filter matched projects by a query",
        type: String,
    },
    tag: {
        description: "Only plan projects carrying one of these tags (repeatable, or comma-separated). Shorthand for --query=\"tag=…\".",
        multiple: true,
        type: String,
    },
} as const;

const actionGraph = defineCommand({
    argument: {
        description: "Target selector (same syntax as `vis run`): `build`, `:build`, `~:test`, `#tag:lint`, …",
        name: "selector",
        type: String,
    },
    description: "Show the execution plan for a target without running it",
    examples: [
        ["vis action-graph build", "Print the task plan for `build` on every project"],
        ["vis action-graph :test", "Moon-style selector"],
        ["vis action-graph build --json", "Emit a JSON description of the plan"],
        ["vis action-graph lint --query \"tag=frontend\"", "Filter projects by query"],
        ["vis action-graph build --projects=@org/web", "Plan only the named projects (same flag as `vis run`)"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "action-graph",
    options: actionGraphOptionDefinitions,
});

export default actionGraph;

export type ActionGraphOptions = InferOptions<typeof actionGraphOptionDefinitions>;
