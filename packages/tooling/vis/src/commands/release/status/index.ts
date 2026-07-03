import type { Command, CreateOptions } from "@visulima/cerebro";

const status: Command = {
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
    options: [
        {
            description: "Emit machine-readable JSON instead of a table",
            name: "json",
            type: Boolean,
        },
        {
            description: "Filter packages by name glob",
            name: "filter",
            type: String,
        },
        {
            description: "Filter by bump level (CSV: major,minor,patch)",
            name: "bump",
            type: String,
        },
        {
            description: "Override channel (defaults to current branch lookup)",
            name: "channel",
            type: String,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default status;

export type ReleaseStatusOptions = CreateOptions<{
    bump: string | undefined;
    channel: string | undefined;
    filter: string | undefined;
    json: boolean | undefined;
    "print-config": string | undefined;
}>;
