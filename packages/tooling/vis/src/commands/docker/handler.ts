import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim } from "@visulima/colorize";
import { isAccessibleSync } from "@visulima/fs";
import { isAbsolute, join } from "@visulima/path";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { detectPackageManager } from "../../preflight/lockfile";
import { pruneDockerContext, scaffoldDockerContext } from "../../util/docker";
import { generateDockerfile } from "../../util/dockerfile";
import type { DockerInitOptions, DockerLintOptions, DockerPruneOptions, DockerScaffoldOptions } from "./index";
import { runDockerLint } from "./lint";

const requireWorkspaceRoot = (workspaceRoot: string | undefined): string => {
    if (!workspaceRoot) {
        throw new Error("Could not determine workspace root. Run inside a monorepo.");
    }

    return workspaceRoot;
};

/** `vis docker scaffold` — build a minimal, cache-friendly Docker context. */
export const scaffoldExecute: CommandExecute<Toolbox<Console, DockerScaffoldOptions>> = async ({ logger, options, visConfig, workspaceRoot }) => {
    const wsRoot = requireWorkspaceRoot(workspaceRoot);
    const { packageJsons, workspace } = discoverWorkspace(wsRoot, visConfig);
    const projectGraph = buildProjectGraph(wsRoot, workspace, packageJsons);

    const focus = (options.focus ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

    if (focus.length === 0) {
        throw new Error("Missing --focus. Pass one or more project names, comma-separated.");
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
};

/** `vis docker prune` — strip unfocused projects from a scaffolded context. */
export const pruneExecute: CommandExecute<Toolbox<Console, DockerPruneOptions>> = async ({ logger, options, visConfig, workspaceRoot }) => {
    const wsRoot = requireWorkspaceRoot(workspaceRoot);
    const { workspace } = discoverWorkspace(wsRoot, visConfig);
    const contextRoot = join(wsRoot, options.context ?? ".vis/docker");

    const { removed } = pruneDockerContext({ contextRoot, workspace, workspaceRoot: wsRoot });

    logger.info(`Pruned ${removed.length} unfocused project(s)`);

    if (removed.length > 0) {
        logger.debug?.(removed.join("\n"));
    }
};

/** `vis docker lint` — lint a Dockerfile with hadolint (downloaded on demand). */
export const lintExecute: CommandExecute<Toolbox<Console, DockerLintOptions>> = async ({ argument, logger, options, workspaceRoot }) => {
    const code = await runDockerLint({
        autoInstall: Boolean(options.install),
        configPath: options.config,
        cwd: workspaceRoot ?? process.cwd(),
        files: argument.filter(Boolean),
        fix: Boolean(options.fix),
        json: Boolean(options.json),
        logger,
    });

    if (code !== 0) {
        process.exitCode = code;
    }
};

const confirmOverwrite = async (path: string): Promise<boolean> => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });

    const answer = await new Promise<string>((resolve) => {
        rl.question(`  ${path} already exists. Overwrite? ${dim("[y/N]")} `, (value) => {
            resolve(value.trim().toLowerCase());
        });
    });

    rl.close();

    return answer === "y" || answer === "yes";
};

/** `vis docker init` — generate a multi-stage Dockerfile (create-only). */
export const initExecute: CommandExecute<Toolbox<Console, DockerInitOptions>> = async ({ argument, logger, options, workspaceRoot }) => {
    const wsRoot = workspaceRoot ?? process.cwd();
    const requested = argument[0] ?? "Dockerfile";
    const outPath = isAbsolute(requested) ? requested : join(wsRoot, requested);

    const manager = detectPackageManager(wsRoot)?.manager ?? "npm";
    const focus = (options.focus ?? "")
        .split(",")
        .map((name) => name.trim())
        .find(Boolean);

    const content = generateDockerfile({ focus, manager, nodeVersion: options.node ?? "22" });

    if (options.dryRun) {
        process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);

        return;
    }

    if (isAccessibleSync(outPath) && !options.force) {
        const interactive = Boolean(process.stdin.isTTY);

        if (!interactive) {
            logger.error(`${outPath} already exists. Re-run with --force to overwrite.`);
            process.exitCode = 1;

            return;
        }

        const overwrite = await confirmOverwrite(outPath);

        if (!overwrite) {
            logger.info("Aborted — existing Dockerfile left untouched.");

            return;
        }
    }

    writeFileSync(outPath, content);
    logger.info(`Created ${outPath} (package manager: ${manager}).`);
    logger.info(dim(`Next: vis docker scaffold${focus ? ` --focus=${focus}` : ""} --include-sources, then DOCKER_BUILDKIT=1 docker build .`));
};
