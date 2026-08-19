import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const statusOptionDefinitions = {
    bump: {
        description: "Filter by bump level (CSV: major,minor,patch)",
        type: String,
    },
    channel: {
        description: "Override channel (defaults to current branch lookup)",
        type: String,
    },
    filter: {
        description: "Filter packages by name glob",
        type: String,
    },
    json: {
        description: "Emit machine-readable JSON instead of a table",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
} as const;

const status = defineCommand({
    commandPath: ["release"],
    description: "Print pending release plan (which packages will bump and to what version)",
    examples: [
        ["vis release status", "Print pending plan in human-readable format"],
        ["vis release status --json", "Emit the plan as JSON for scripting / CI"],
        ["vis release status --bump major,minor", "Filter to packages getting major or minor bumps"],
        ["vis release status --filter '@scope/*'", "Show only packages matching the glob"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "status",
    options: statusOptionDefinitions,
});

export default status;

export type ReleaseStatusOptions = InferOptions<typeof statusOptionDefinitions>;
