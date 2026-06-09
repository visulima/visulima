import type { Command, CreateOptions } from "@visulima/cerebro";

const plan: Command = {
    commandPath: ["release"],
    description: "Inspect the release plan; with --interactive, walk through and override bump levels",
    examples: [
        ["vis release plan", "Emit pending plan as JSON"],
        ["vis release plan --interactive", "Walk through pending releases, accept or override each bump"],
        ["vis release plan -i --write", "Walk through interactively and write the chosen overrides to a change file"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "plan",
    options: [
        {
            description: "Filter packages by name glob",
            name: "filter",
            type: String,
        },
        {
            description: "Override channel (defaults to current branch lookup)",
            name: "channel",
            type: String,
        },
        {
            alias: "i",
            description: "Walk through pending releases interactively and accept / override each bump level",
            name: "interactive",
            type: Boolean,
        },
        {
            description: "When used with --interactive, write the chosen overrides to a new change file (.vis/release/<id>.md)",
            name: "write",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default plan;

export type ReleasePlanOptions = CreateOptions<{
    channel: string | undefined;
    filter: string | undefined;
    interactive: boolean | undefined;
    "print-config": string | undefined;
    write: boolean | undefined;
}>;
