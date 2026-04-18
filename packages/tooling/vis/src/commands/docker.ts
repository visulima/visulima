import type { Command } from "@visulima/cerebro";
import { join } from "@visulima/path";

import { pruneDockerContext, scaffoldDockerContext } from "../docker";
import { buildProjectGraph, discoverWorkspace } from "../workspace";

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
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const subcommand = argument[0];

        if (!subcommand) {
            throw new Error("Missing subcommand. Usage: vis docker <scaffold|prune>");
        }

        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run inside a monorepo.");
        }

        const { packageJsons, workspace } = discoverWorkspace(wsRoot, visConfig);

        if (subcommand === "scaffold") {
            const projectGraph = buildProjectGraph(wsRoot, workspace, packageJsons);
            const focusRaw = options.focus as string | undefined;

            if (!focusRaw) {
                throw new Error("Missing --focus. Pass one or more project names, comma-separated.");
            }

            const focus = focusRaw
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean);

            if (focus.length === 0) {
                throw new Error("--focus resolved to an empty list. Provide at least one project name.");
            }

            const outDir = join(wsRoot, (options.out as string | undefined) ?? ".vis/docker");

            const { projects } = scaffoldDockerContext({
                focus,
                includeSources: Boolean(options.includeSources),
                outDir,
                projectGraph,
                workspace,
                workspaceRoot: wsRoot,
            });

            logger.info(`Scaffolded ${projects.length} project(s) into ${outDir}`);
            logger.info(`Focus closure: ${projects.sort().join(", ")}`);

            return;
        }

        if (subcommand === "prune") {
            const contextRoot = join(wsRoot, (options.context as string | undefined) ?? ".vis/docker");

            const { removed } = pruneDockerContext({
                contextRoot,
                workspace,
                workspaceRoot: wsRoot,
            });

            logger.info(`Pruned ${removed.length} unfocused project(s)`);

            if (removed.length > 0) {
                logger.debug?.(removed.join("\n"));
            }

            return;
        }

        throw new Error(`Unknown subcommand: "${subcommand}". Expected scaffold or prune.`);
    },
    group: "Workspace",
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
