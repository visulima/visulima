import type { Command, CreateOptions } from "@visulima/cerebro";

const ciRebasePr: Command = {
    commandPath: ["release", "ci"],
    description: "CI: rebase the open version-PR onto the base branch and force-push",
    examples: [
        ["vis release ci rebase-pr", "Rebase the version-PR branch onto base + force-push"],
        ["vis release ci rebase-pr --branch=release/version", "Override the version-PR branch"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "rebase-pr",
    options: [
        {
            description: "Override the version-PR branch (default: vis-release/version-packages)",
            name: "branch",
            type: String,
        },
        {
            description: "Override the base branch (default: release.baseBranch)",
            name: "base",
            type: String,
        },
    ],
};

export default ciRebasePr;

export type ReleaseCiRebasePrOptions = CreateOptions<{
    base: string | undefined;
    branch: string | undefined;
}>;
