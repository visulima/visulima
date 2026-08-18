import type { AnyCommandInput, InferOptions } from "@visulima/cerebro";
import { defineCommand, lazyNamed } from "@visulima/cerebro";

import { negatable } from "../../util/negatable-option";

/**
 * `vis docker` — Docker integration subcommands.
 *
 * - `scaffold` / `prune` mirror moon's `moon docker scaffold|prune`: keep
 *   install layers cache-friendly by copying only the focus closure.
 * - `init` generates a multi-stage Dockerfile wired to that scaffold flow
 *   (create-only; prompts before overwriting an existing Dockerfile).
 * - `lint` runs hadolint (downloaded on demand) over a Dockerfile, with
 *   `--fix` applying the safe, mechanical autofixes.
 *
 * (The `.dockerignore` generator moved to the top-level `vis ignore`
 * command — `vis ignore --target=docker`.)
 */

const GROUP = "Workspace";

const dockerScaffoldOptionDefinitions = {
    focus: {
        description: "Project name(s) to focus on — comma-separated for multiple",
        type: String,
    },
    "include-sources": {
        defaultValue: false,
        description: "Also copy focus project source trees to <out>/sources",
        type: Boolean,
    },
    out: {
        description: "Output directory for the scaffold (default: .vis/docker)",
        type: String,
    },
    ...negatable({
        defaultValue: true,
        description: "Rewrite the workspace lockfile to drop unfocused projects (use --no-prune-lockfile to copy verbatim)",
        name: "prune-lockfile",
        type: Boolean,
    }),
} as const;

const dockerScaffold = defineCommand({
    commandPath: ["docker"],
    description: "Build a minimal, cache-friendly Docker context for a focus project + its deps",
    examples: [
        ["vis docker scaffold --focus=my-app", "Generate .vis/docker/workspace for my-app + its deps"],
        ["vis docker scaffold --focus=my-app --include-sources", "Also copy focus source trees"],
        ["vis docker scaffold --focus=my-app,other --out=.vis/docker", "Focus multiple projects"],
    ],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "scaffoldExecute"),
    name: "scaffold",
    options: dockerScaffoldOptionDefinitions,
});

const dockerPruneOptionDefinitions = {
    context: {
        description: "Scaffold root for prune (default: .vis/docker)",
        type: String,
    },
} as const;

const dockerPrune = defineCommand({
    commandPath: ["docker"],
    description: "Strip unfocused workspace projects from a scaffolded context (run inside a build stage)",
    examples: [["vis docker prune --context=.vis/docker", "Strip unfocused projects inside a build stage"]],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "pruneExecute"),
    name: "prune",
    options: dockerPruneOptionDefinitions,
});

const dockerInitOptionDefinitions = {
    "dry-run": {
        defaultValue: false,
        description: "Print the Dockerfile to stdout instead of writing it",
        type: Boolean,
    },
    focus: {
        description: "Focus project name for the build filter",
        type: String,
    },
    force: {
        defaultValue: false,
        description: "Overwrite an existing Dockerfile without prompting",
        type: Boolean,
    },
    node: {
        description: "Node.js version tag for the base image (default: 22)",
        type: String,
    },
} as const;

const dockerInit = defineCommand({
    argument: { description: "Output path for the Dockerfile (default: ./Dockerfile)", name: "path", type: String },
    commandPath: ["docker"],
    description: "Generate a multi-stage Dockerfile wired to the scaffold/prune flow (create-only)",
    examples: [
        ["vis docker init", "Generate ./Dockerfile for the detected package manager"],
        ["vis docker init --focus=my-app", "Target a specific project's build"],
        ["vis docker init --node=24 --force", "Use Node 24 and overwrite without prompting"],
        ["vis docker init --dry-run", "Print the Dockerfile instead of writing it"],
    ],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "initExecute"),
    name: "init",
    options: dockerInitOptionDefinitions,
});

const dockerLintOptionDefinitions = {
    config: {
        description: "Path to a hadolint config (.hadolint.yaml)",
        type: String,
    },
    fix: {
        defaultValue: false,
        description: "Apply safe autofixes, then re-lint and report what remains",
        type: Boolean,
    },
    install: {
        defaultValue: false,
        description: "Download hadolint without prompting if it is missing",
        type: Boolean,
    },
    json: {
        defaultValue: false,
        description: "Emit findings as JSON",
        type: Boolean,
    },
} as const;

const dockerLint = defineCommand({
    argument: { description: "Dockerfile path(s) to lint (default: ./Dockerfile)", name: "file", type: String },
    commandPath: ["docker"],
    description: "Lint a Dockerfile with hadolint (downloaded on demand); --fix applies safe autofixes",
    examples: [
        ["vis docker lint", "Lint ./Dockerfile (prompts to download hadolint on first use)"],
        ["vis docker lint apps/web/Dockerfile", "Lint a specific Dockerfile"],
        ["vis docker lint --fix", "Apply safe autofixes, then report what remains"],
        ["vis docker lint --install --json", "Auto-download hadolint and emit JSON"],
    ],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "lintExecute"),
    name: "lint",
    options: dockerLintOptionDefinitions,
});

const dockerCommands: AnyCommandInput[] = [dockerScaffold, dockerPrune, dockerInit, dockerLint];

export default dockerCommands;

export type DockerScaffoldOptions = InferOptions<typeof dockerScaffoldOptionDefinitions>;

export type DockerPruneOptions = InferOptions<typeof dockerPruneOptionDefinitions>;

export type DockerInitOptions = InferOptions<typeof dockerInitOptionDefinitions>;

export type DockerLintOptions = InferOptions<typeof dockerLintOptionDefinitions>;
