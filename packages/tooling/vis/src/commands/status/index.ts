import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const statusOptionDefinitions = {
    json: {
        defaultValue: false,
        description: "Emit JSON output",
        type: Boolean,
    },
} as const;

const status = defineCommand({
    description: "Show a workspace health dashboard at a glance",
    examples: [
        ["vis status", "Full status overview"],
        ["vis status --json", "Machine-readable output"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "status",
    options: statusOptionDefinitions,
});

export default status;

export type StatusOptions = InferOptions<typeof statusOptionDefinitions>;
