import type { Command, CreateOptions } from "@visulima/cerebro";

const publish: Command = {
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
    options: [
        {
            description: "Skip uploads — print what would happen",
            name: "dry-run",
            type: Boolean,
        },
        {
            description: "Override npm dist-tag",
            name: "tag",
            type: String,
        },
        {
            description: "Limit to packages matching this glob (CSV)",
            name: "filter",
            type: String,
        },
        {
            description: "Skip `git push --tags` after publish (lands in M5)",
            name: "no-push",
            type: Boolean,
        },
        {
            description: "2FA OTP token",
            name: "otp",
            type: String,
        },
        {
            description: "Override channel (defaults to current branch lookup)",
            name: "channel",
            type: String,
        },
        {
            description: "Resume from a previous run's state file (skips already-published packages)",
            name: "resume",
            type: Boolean,
        },
        {
            description: "Run preflight checks (config + workspace + plan + auth) and exit. No mutations.",
            name: "check-only",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
        {
            description: "Bootstrap mode for greenfield monorepos: force currentVersionResolver=disk and skip remote tag-collision checks. Use on the very first release before any git tags exist.",
            name: "first-release",
            type: Boolean,
        },
    ],
};

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
