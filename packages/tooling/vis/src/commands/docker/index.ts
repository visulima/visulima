import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis docker scaffold` / `vis docker prune` — scaffolding and pruning
 * helpers that mirror moon's `moon docker scaffold` and `moon docker prune`
 * commands. Used inside Dockerfiles to keep install layers cache-friendly.
 *
 * Typical Dockerfile usage:
 *
 * ```dockerfile
 * FROM node:22 AS deps
 * WORKDIR /app
 * COPY .vis/docker/workspace/ ./
 * RUN pnpm install --frozen-lockfile
 *
 * FROM deps AS build
 * COPY .vis/docker/sources/ ./
 * RUN pnpm --filter my-app build
 * RUN vis docker prune --context=.vis/docker
 * ```
 */
const docker: Command = {
    argument: {
        description: "Docker subcommand: scaffold | prune",
        name: "subcommand",
        type: String,
    },
    description: "Docker integration — scaffold a minimal context or prune unfocused deps",
    examples: [
        ["vis docker scaffold --focus=my-app", "Generate .vis/docker/workspace for my-app + its deps"],
        ["vis docker scaffold --focus=my-app --include-sources", "Also copy focus source trees"],
        ["vis docker scaffold --focus=my-app,other --out=.vis/docker", "Focus multiple projects"],
        ["vis docker prune --context=.vis/docker", "Strip unfocused projects inside a build stage"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "docker",
    options: [
        {
            description: "Project name(s) to focus on — comma-separated for multiple",
            name: "focus",
            type: String,
        },
        {
            description: "Output directory for the scaffold (default: .vis/docker)",
            name: "out",
            type: String,
        },
        {
            defaultValue: false,
            description: "Also copy focus project source trees to <out>/sources",
            name: "include-sources",
            type: Boolean,
        },
        {
            description: "Scaffold root for `vis docker prune` (default: .vis/docker)",
            name: "context",
            type: String,
        },
    ],
};

export default docker;

export type DockerOptions = CreateOptions<{
    "focus": string | undefined;
    "out": string | undefined;
    "include-sources": boolean | undefined;
    "context": string | undefined;
}>;
