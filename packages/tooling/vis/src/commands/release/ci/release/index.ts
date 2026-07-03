import type { Command, CreateOptions } from "@visulima/cerebro";

const ciRelease: Command = {
    commandPath: ["release", "ci"],
    description: "CI: maintain a rolling version-PR (default) or version+publish inline (--auto-publish)",
    examples: [
        ["vis release ci release", "On push to main: open/update Versioned release PR; on PR merge: publish"],
        ["vis release ci release --auto-publish", "Skip version-PR; version + publish inline (alpha/beta workflow)"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "release",
    options: [
        {
            description: "Skip version-PR; version + publish inline",
            name: "auto-publish",
            type: Boolean,
        },
        {
            description: "Override version-PR branch (default: vis-release/version-packages)",
            name: "branch",
            type: String,
        },
        {
            description: "Override channel (defaults to current branch lookup)",
            name: "channel",
            type: String,
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

export default ciRelease;

export type ReleaseCiReleaseOptions = CreateOptions<{
    "auto-publish": boolean | undefined;
    branch: string | undefined;
    channel: string | undefined;
    "first-release": boolean | undefined;
    "print-config": string | undefined;
}>;
