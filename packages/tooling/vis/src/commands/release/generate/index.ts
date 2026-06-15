import type { Command, CreateOptions } from "@visulima/cerebro";

const generate: Command = {
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
    options: [
        {
            description: "Git ref to compare against (default: merge-base with baseBranch)",
            name: "from",
            type: String,
        },
        {
            description: "Slug for the generated filename (default: random animal name)",
            name: "name",
            type: String,
        },
        {
            description: "Print would-be content without writing",
            name: "dry-run",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default generate;

export type ReleaseGenerateOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    from: string | undefined;
    name: string | undefined;
    "print-config": string | undefined;
}>;
