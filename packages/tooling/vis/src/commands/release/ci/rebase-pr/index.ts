import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const ciRebasePrOptionDefinitions = {
    base: {
        description: "Override the base branch (default: release.baseBranch)",
        type: String,
    },
    branch: {
        description: "Override the version-PR branch (default: vis-release/version-packages)",
        type: String,
    },
} as const;

const ciRebasePr = defineCommand({
    commandPath: ["release", "ci"],
    description: "CI: rebase the open version-PR onto the base branch and force-push",
    examples: [
        ["vis release ci rebase-pr", "Rebase the version-PR branch onto base + force-push"],
        ["vis release ci rebase-pr --branch=release/version", "Override the version-PR branch"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "rebase-pr",
    options: ciRebasePrOptionDefinitions,
});

export default ciRebasePr;

export type ReleaseCiRebasePrOptions = CreateOptions<{
    base: string | undefined;
    branch: string | undefined;
}>;
