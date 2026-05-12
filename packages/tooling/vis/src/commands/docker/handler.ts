import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { join } from "@visulima/path";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { pruneDockerContext, scaffoldDockerContext } from "../../util/docker";
import type { DockerOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, DockerOptions>): Promise<void> => {
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
        const focusRaw = options.focus;

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

        const outDir = join(wsRoot, options.out ?? ".vis/docker");

        const { projects } = scaffoldDockerContext({
            focus,
            includeSources: Boolean(options.includeSources),
            log: (message) => {
                logger.info(message);
            },
            outDir,
            projectGraph,
            pruneLockfile: options.pruneLockfile !== false,
            workspace,
            workspaceRoot: wsRoot,
        });

        logger.info(`Scaffolded ${projects.length} project(s) into ${outDir}`);
        logger.info(`Focus closure: ${projects.toSorted().join(", ")}`);

        return;
    }

    if (subcommand === "prune") {
        const contextRoot = join(wsRoot, options.context ?? ".vis/docker");

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
};

export default execute as CommandExecute<Toolbox>;
