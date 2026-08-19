import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const pretrustOptionDefinitions = {
    access: {
        description: "Publish access: public | restricted (default: public)",
        type: String,
    },
    "allow-stage-publish": {
        description: "Trust claim: also grant the staged-publish permission (--allow-stage-publish)",
        type: Boolean,
    },
    "dry-run": {
        description: "Print what would publish without uploading",
        type: Boolean,
    },
    env: {
        description: "Trust claim: restrict to a deployment environment (npm trust --env)",
        type: String,
    },
    filter: {
        description: "Glob filter (CSV) — limit to specific packages",
        type: String,
    },
    force: {
        description: "Publish a placeholder even if the package already exists on the registry",
        type: Boolean,
    },
    "no-trust": {
        description: "Skip the `npm trust` step (only publish placeholders)",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit",
        type: String,
    },
    provider: {
        description: "Trust claim: forge provider (github | gitlab). Default: auto-detect from the git remote",
        type: String,
    },
    registry: {
        description: "Override registry URL",
        type: String,
    },
    repo: {
        description: "Trust claim: owner/repo (github) or group/project (gitlab). Default: detect from git remote",
        type: String,
    },
    tag: {
        description: "dist-tag for the placeholder (default: placeholder — keeps `latest` unset)",
        type: String,
    },
    version: {
        description: "Placeholder version (default: 0.0.0)",
        type: String,
    },
    workflow: {
        description: "Trust claim: workflow/pipeline filename (npm trust --file). Default: auto-detect the release workflow",
        type: String,
    },
} as const;

const pretrust = defineCommand({
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
    options: pretrustOptionDefinitions,
});

export default pretrust;

export type ReleasePretrustOptions = InferOptions<typeof pretrustOptionDefinitions>;
