import type { Command, CreateOptions } from "@visulima/cerebro";

const pretrust: Command = {
    commandPath: ["release"],
    description: "Publish non-functional placeholder packages so npm Trusted Publishing (OIDC) can be configured before the first release",
    examples: [
        ["vis release pretrust", "Publish a placeholder for every managed package missing from the registry"],
        ["vis release pretrust --filter '@scope/*'", "Limit to a glob"],
        ["vis release pretrust --dry-run", "Print what would be published without uploading"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "pretrust",
    options: [
        {
            description: "Glob filter (CSV) — limit to specific packages",
            name: "filter",
            type: String,
        },
        {
            description: "dist-tag for the placeholder (default: placeholder — keeps `latest` unset)",
            name: "tag",
            type: String,
        },
        {
            description: "Placeholder version (default: 0.0.0)",
            name: "version",
            type: String,
        },
        {
            description: "Publish access: public | restricted (default: public)",
            name: "access",
            type: String,
        },
        {
            description: "Override registry URL",
            name: "registry",
            type: String,
        },
        {
            description: "Publish a placeholder even if the package already exists on the registry",
            name: "force",
            type: Boolean,
        },
        {
            description: "Skip the `npm trust` step (only publish placeholders)",
            name: "no-trust",
            type: Boolean,
        },
        {
            description: "Trust claim: forge provider (github | gitlab). Default: auto-detect from the git remote",
            name: "provider",
            type: String,
        },
        {
            description: "Trust claim: owner/repo (github) or group/project (gitlab). Default: detect from git remote",
            name: "repo",
            type: String,
        },
        {
            description: "Trust claim: workflow/pipeline filename (npm trust --file). Default: auto-detect the release workflow",
            name: "workflow",
            type: String,
        },
        {
            description: "Trust claim: restrict to a deployment environment (npm trust --env)",
            name: "env",
            type: String,
        },
        {
            description: "Trust claim: also grant the staged-publish permission (--allow-stage-publish)",
            name: "allow-stage-publish",
            type: Boolean,
        },
        {
            description: "Print what would publish without uploading",
            name: "dry-run",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit",
            name: "print-config",
            type: String,
        },
    ],
};

export default pretrust;

export type ReleasePretrustOptions = CreateOptions<{
    access: string | undefined;
    "allow-stage-publish": boolean | undefined;
    "dry-run": boolean | undefined;
    env: string | undefined;
    filter: string | undefined;
    force: boolean | undefined;
    "no-trust": boolean | undefined;
    "print-config": string | undefined;
    provider: string | undefined;
    registry: string | undefined;
    repo: string | undefined;
    tag: string | undefined;
    version: string | undefined;
    workflow: string | undefined;
}>;
