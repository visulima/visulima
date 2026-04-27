import type { Command, CreateOptions } from "@visulima/cerebro";

const list: Command = {
    description: "List all workspace projects with metadata",
    examples: [
        ["vis list", "Show all projects"],
        ["vis list --json", "Machine-readable output"],
        ['vis list --query "tag=frontend"', "Filter by query"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "list",
    options: [
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
    ],
};

export default list;

export type ListOptions = CreateOptions<{
    "json": boolean | undefined;
    "query": string | undefined;
}>;
