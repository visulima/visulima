import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const generateOptionDefinitions = {
    "allow-full-history": {
        description: "With --since-last-release: walk the whole history when no release tag matches (first release only)",
        type: Boolean,
    },
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
    "since-last-release": {
        description: "Start the range at the most recent releaseTagPattern tag reachable from HEAD (fails when no tag matches)",
        type: Boolean,
    },
} as const;

const generate = defineCommand({
    commandPath: ["release"],
    description: "Auto-derive a change file from branch commits (conventional-commits + path heuristics)",
    examples: [
        ["vis release generate", "Walk commits since the merge-base with baseBranch"],
        ["vis release generate --from origin/main", "Walk commits since the given ref"],
        ["vis release generate --since-last-release", "Walk commits since the most recent release tag reachable from HEAD"],
        ["vis release generate --since-last-release --allow-full-history", "First release: no tag exists yet, so walk everything"],
        ["vis release generate --dry-run", "Print the would-be content without writing"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "generate",
    options: generateOptionDefinitions,
});

export default generate;

export type ReleaseGenerateOptions = InferOptions<typeof generateOptionDefinitions>;
