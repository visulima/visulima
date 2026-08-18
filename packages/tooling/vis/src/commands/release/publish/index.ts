import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const publishOptionDefinitions = {
    channel: {
        description: "Override channel (defaults to current branch lookup)",
        type: String,
    },
    "check-only": {
        description: "Run preflight checks (config + workspace + plan + auth) and exit. No mutations.",
        type: Boolean,
    },
    "dry-run": {
        description: "Skip uploads — print what would happen",
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
    "no-push": {
        description: "Skip `git push --tags` after publish (lands in M5)",
        type: Boolean,
    },
    otp: {
        description: "2FA OTP token",
        type: String,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
    resume: {
        description: "Resume from a previous run's state file (skips already-published packages)",
        type: Boolean,
    },
    tag: {
        description: "Override npm dist-tag",
        type: String,
    },
} as const;

const publish = defineCommand({
    commandPath: ["release"],
    description: "Pack-then-publish unpublished packages, push tags, create GH releases",
    examples: [
        ["vis release publish", "Publish all pending packages"],
        ["vis release publish --dry-run", "Print what would publish without uploading"],
        ["vis release publish --tag alpha", "Override dist-tag"],
        ["vis release publish --filter '@scope/*'", "Limit to packages matching the glob"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "publish",
    options: publishOptionDefinitions,
});

export default publish;

export type ReleasePublishOptions = CreateOptions<{
    channel: string | undefined;
    "check-only": boolean | undefined;
    "dry-run": boolean | undefined;
    filter: string | undefined;
    "first-release": boolean | undefined;
    "no-push": boolean | undefined;
    otp: string | undefined;
    "print-config": string | undefined;
    resume: boolean | undefined;
    tag: string | undefined;
}>;
