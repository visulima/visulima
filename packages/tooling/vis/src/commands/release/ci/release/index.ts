import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const ciReleaseOptionDefinitions = {
    "auto-publish": {
        description: "Skip version-PR; version + publish inline",
        type: Boolean,
    },
    branch: {
        description: "Override version-PR branch (default: vis-release/version-packages)",
        type: String,
    },
    channel: {
        description: "Override channel (defaults to current branch lookup)",
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

const ciRelease = defineCommand({
    commandPath: ["release", "ci"],
    description: "CI: maintain a rolling version-PR (default) or version+publish inline (--auto-publish)",
    examples: [
        ["vis release ci release", "On push to main: open/update Versioned release PR; on PR merge: publish"],
        ["vis release ci release --auto-publish", "Skip version-PR; version + publish inline (alpha/beta workflow)"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "release",
    options: ciReleaseOptionDefinitions,
});

export default ciRelease;

export type ReleaseCiReleaseOptions = CreateOptions<{
    "auto-publish": boolean | undefined;
    branch: string | undefined;
    channel: string | undefined;
    "first-release": boolean | undefined;
    "print-config": string | undefined;
}>;
