import type { Command, CreateOptions } from "@visulima/cerebro";

const status: Command = {
    description: "Show a workspace health dashboard at a glance",
    examples: [
        ["vis status", "Full status overview"],
        ["vis status --json", "Machine-readable output"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "status",
    options: [
        {
            defaultValue: false,
            description: "Emit JSON output",
            name: "json",
            type: Boolean,
        },
    ],
};

export default status;

export type StatusOptions = CreateOptions<{
    "json": boolean | undefined;
}>;
