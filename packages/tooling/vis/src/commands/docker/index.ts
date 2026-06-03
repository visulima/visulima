import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

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

const dockerScaffold: Command = {
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
    options: [
        { description: "Project name(s) to focus on — comma-separated for multiple", name: "focus", type: String },
        { description: "Output directory for the scaffold (default: .vis/docker)", name: "out", type: String },
        { defaultValue: false, description: "Also copy focus project source trees to <out>/sources", name: "include-sources", type: Boolean },
        {
            defaultValue: true,
            description: "Rewrite the workspace lockfile to drop unfocused projects (use --no-prune-lockfile to copy verbatim)",
            name: "prune-lockfile",
            type: Boolean,
        },
    ],
};

const dockerPrune: Command = {
    commandPath: ["docker"],
    description: "Strip unfocused workspace projects from a scaffolded context (run inside a build stage)",
    examples: [["vis docker prune --context=.vis/docker", "Strip unfocused projects inside a build stage"]],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "pruneExecute"),
    name: "prune",
    options: [{ description: "Scaffold root for prune (default: .vis/docker)", name: "context", type: String }],
};

const dockerInit: Command = {
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
    options: [
        { description: "Focus project name for the build filter", name: "focus", type: String },
        { description: "Node.js version tag for the base image (default: 22)", name: "node", type: String },
        { defaultValue: false, description: "Overwrite an existing Dockerfile without prompting", name: "force", type: Boolean },
        { defaultValue: false, description: "Print the Dockerfile to stdout instead of writing it", name: "dry-run", type: Boolean },
    ],
};

const dockerLint: Command = {
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
    options: [
        { defaultValue: false, description: "Apply safe autofixes, then re-lint and report what remains", name: "fix", type: Boolean },
        { defaultValue: false, description: "Download hadolint without prompting if it is missing", name: "install", type: Boolean },
        { description: "Path to a hadolint config (.hadolint.yaml)", name: "config", type: String },
        { defaultValue: false, description: "Emit findings as JSON", name: "json", type: Boolean },
    ],
};

const dockerCommands: Command[] = [dockerScaffold, dockerPrune, dockerInit, dockerLint];

export default dockerCommands;

export type DockerScaffoldOptions = CreateOptions<{
    focus: string | undefined;
    "include-sources": boolean | undefined;
    out: string | undefined;
    "prune-lockfile": boolean | undefined;
}>;

export type DockerPruneOptions = CreateOptions<{
    context: string | undefined;
}>;

export type DockerInitOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    focus: string | undefined;
    force: boolean | undefined;
    node: string | undefined;
}>;

export type DockerLintOptions = CreateOptions<{
    config: string | undefined;
    fix: boolean | undefined;
    install: boolean | undefined;
    json: boolean | undefined;
}>;
