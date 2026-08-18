import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const planOptionDefinitions = {
    channel: {
        description: "Override channel (defaults to current branch lookup)",
        type: String,
    },
    filter: {
        description: "Filter packages by name glob",
        type: String,
    },
    interactive: {
        alias: "i",
        description: "Walk through pending releases interactively and accept / override each bump level",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
    write: {
        description: "When used with --interactive, write the chosen overrides to a new change file (.vis/release/<id>.md)",
        type: Boolean,
    },
} as const;

const plan = defineCommand({
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
    options: planOptionDefinitions,
});

export default plan;

export type ReleasePlanOptions = InferOptions<typeof planOptionDefinitions>;
