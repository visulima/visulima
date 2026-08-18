import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const preOptionDefinitions = {
    action: {
        defaultOption: true,
        defaultValue: "status",
        description: "Subcommand: enter | exit | status",
        type: String,
    },
    commit: {
        defaultValue: true,
        description: "Commit pre.json after writing. Default: commit",
        type: Boolean,
    },
    push: {
        defaultValue: true,
        description: "Push the commit. Default: push",
        type: Boolean,
    },
    tag: {
        description: "Prerelease tag (e.g. alpha, beta, rc). Required for `enter`",
        multiple: true,
        type: String,
    },
} as const;

const pre = defineCommand({
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
    options: preOptionDefinitions,
});

export default pre;

export type ReleasePreOptions = InferOptions<typeof preOptionDefinitions>;
