import type { Command, CreateOptions } from "@visulima/cerebro";

const pre: Command = {
    commandPath: ["release"],
    description: "Enter / exit pre-release mode (changesets-compatible — every `version` produces a prerelease until exit)",
    examples: [
        ["vis release pre enter alpha", "Enter pre-mode with the `alpha` tag"],
        ["vis release pre enter rc --no-commit", "Enter pre-mode locally without committing pre.json"],
        ["vis release pre exit", "Flag the next `version` to consolidate + exit pre-mode"],
        ["vis release pre status", "Print whether pre-mode is active, exit-pending, or off"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "pre",
    options: [
        {
            defaultOption: true,
            defaultValue: "status",
            description: "Subcommand: enter | exit | status",
            name: "action",
            type: String,
        },
        {
            description: "Prerelease tag (e.g. alpha, beta, rc). Required for `enter`",
            multiple: true,
            name: "tag",
            type: String,
        },
        {
            defaultValue: true,
            description: "Commit pre.json after writing. Default: commit",
            name: "commit",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Push the commit. Default: push",
            name: "push",
            type: Boolean,
        },
    ],
};

export default pre;

export type ReleasePreOptions = CreateOptions<{
    action: string;
    commit: boolean | undefined;
    push: boolean | undefined;
    tag: string[] | undefined;
}>;
