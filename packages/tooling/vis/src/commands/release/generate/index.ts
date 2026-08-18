import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const generateOptionDefinitions = {
    "dry-run": {
        description: "Print would-be content without writing",
        type: Boolean,
    },
    from: {
        description: "Git ref to compare against (default: merge-base with baseBranch)",
        type: String,
    },
    name: {
        description: "Slug for the generated filename (default: random animal name)",
        type: String,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
} as const;

const generate = defineCommand({
    commandPath: ["release"],
    description: "Auto-derive a change file from branch commits (conventional-commits + path heuristics)",
    examples: [
        ["vis release generate", "Walk commits since the merge-base with baseBranch"],
        ["vis release generate --from origin/main", "Walk commits since the given ref"],
        ["vis release generate --dry-run", "Print the would-be content without writing"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "generate",
    options: generateOptionDefinitions,
});

export default generate;

export type ReleaseGenerateOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    from: string | undefined;
    name: string | undefined;
    "print-config": string | undefined;
}>;
