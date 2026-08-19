import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const versionOptionDefinitions = {
    channel: {
        description: "Override channel (defaults to current branch lookup)",
        type: String,
    },
    "check-only": {
        description: "Run preflight checks (config + workspace + plan) and exit. No mutations.",
        type: Boolean,
    },
    commit: {
        description: "Auto-commit after applying",
        type: Boolean,
    },
    "dry-run": {
        description: "Skip writes — print the diff and exit",
        type: Boolean,
    },
    filter: {
        description: "Limit to packages matching this glob (CSV)",
        type: String,
    },
    "first-release": {
        description:
                "Bootstrap mode for greenfield monorepos: force currentVersionResolver=disk and skip remote tag-collision checks. Use on the very first release before any git tags exist.",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
} as const;

const version = defineCommand({
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
    options: versionOptionDefinitions,
});

export default version;

export type ReleaseVersionOptions = InferOptions<typeof versionOptionDefinitions>;
