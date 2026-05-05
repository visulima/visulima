import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis action-graph &lt;selector>` — shows the execution plan that would
 * be produced by `vis run &lt;selector>` without running anything. Matches
 * moon's `moon action-graph`.
 */
const actionGraph: Command = {
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
        ['vis action-graph lint --query "tag=frontend"', "Filter projects by query"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "action-graph",
    options: [
        {
            defaultValue: false,
            description: "Emit JSON instead of ASCII",
            name: "json",
            type: Boolean,
        },
        {
            description: "Filter matched projects by a query",
            name: "query",
            type: String,
        },
    ],
};

export default actionGraph;

export type ActionGraphOptions = CreateOptions<{
    json: boolean | undefined;
    query: string | undefined;
}>;
