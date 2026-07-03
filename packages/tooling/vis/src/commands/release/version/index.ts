import type { Command, CreateOptions } from "@visulima/cerebro";

const version: Command = {
    commandPath: ["release"],
    description: "Apply pending change files to disk: bump versions + write CHANGELOG entries",
    examples: [
        ["vis release version", "Apply the plan to disk"],
        ["vis release version --dry-run", "Print what would change without touching disk"],
        ["vis release version --channel alpha", "Force a specific channel (overrides branch detection)"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "version",
    options: [
        {
            description: "Skip writes — print the diff and exit",
            name: "dry-run",
            type: Boolean,
        },
        {
            description: "Override channel (defaults to current branch lookup)",
            name: "channel",
            type: String,
        },
        {
            description: "Limit to packages matching this glob (CSV)",
            name: "filter",
            type: String,
        },
        {
            description: "Auto-commit after applying",
            name: "commit",
            type: Boolean,
        },
        {
            description: "Run preflight checks (config + workspace + plan) and exit. No mutations.",
            name: "check-only",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
        {
            description:
                "Bootstrap mode for greenfield monorepos: force currentVersionResolver=disk and skip remote tag-collision checks. Use on the very first release before any git tags exist.",
            name: "first-release",
            type: Boolean,
        },
    ],
};

export default version;

export type ReleaseVersionOptions = CreateOptions<{
    channel: string | undefined;
    "check-only": boolean | undefined;
    commit: boolean | undefined;
    "dry-run": boolean | undefined;
    filter: string | undefined;
    "first-release": boolean | undefined;
    "print-config": string | undefined;
}>;
