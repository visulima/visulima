import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { MigrationReport } from "./types";

interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

/**
 * Shape of the subset of turbo.json we care about.
 */
interface TurboJson {
    extends?: string[];
    globalDependencies?: string[];
    globalEnv?: string[];
    globalPassThroughEnv?: string[];
    pipeline?: Record<string, TurboTask>;
    tasks?: Record<string, TurboTask>;
    remoteCache?: {
        enabled?: boolean;
        signature?: boolean;
        teamId?: string;
        apiUrl?: string;
    };
    ui?: "stream" | "tui";
}

interface TurboTask {
    cache?: boolean;
    dependsOn?: string[];
    env?: string[];
    inputs?: string[];
    outputs?: string[];
    persistent?: boolean;
    interactive?: boolean;
    outputLogs?: "full" | "hash-only" | "new-only" | "errors-only" | "none";
    passThroughEnv?: string[];
}

/**
 * Converts a turbo task's `dependsOn` values to vis's `dependsOn`
 * shape. turbo's `^build` (run build on dependencies first) and
 * `project#task` forms translate cleanly.
 */
const convertDependsOn = (deps: string[]): (string | { target: string; dependencies?: boolean; projects?: string | string[] })[] => {
    const result: (string | { target: string; dependencies?: boolean; projects?: string | string[] })[] = [];

    for (const dep of deps) {
        // turbo: `^build` means run `build` on every dependency first
        if (dep.startsWith("^")) {
            result.push({ dependencies: true, target: dep.slice(1) });
            continue;
        }

        // turbo: `project#task` → explicit project + target
        if (dep.includes("#")) {
            const [project, target] = dep.split("#");

            result.push({ projects: project, target: target! });
            continue;
        }

        // Plain task name — same project
        result.push(dep);
    }

    return result;
};

/**
 * Render the vis.config.ts contents for a migrated turbo.json.
 * We emit a pretty-printed TS file rather than using a formatter so
 * the migration is dependency-free.
 */
const renderVisConfig = (turbo: TurboJson): string => {
    const tasks = turbo.tasks ?? turbo.pipeline ?? {};
    const targetDefaults: Record<string, Record<string, unknown>> = {};

    for (const [taskName, task] of Object.entries(tasks)) {
        // Skip concrete `project#task` entries — they belong in per-project
        // config, not in workspace-wide defaults.
        if (taskName.includes("#")) {
            continue;
        }

        const options: Record<string, unknown> = {};

        if (task.persistent) {
            options.persistent = true;
        }

        if (task.interactive) {
            options.interactive = true;
        }

        const entry: Record<string, unknown> = {};

        if (task.cache === false) {
            entry.cache = false;
        }

        if (task.dependsOn && task.dependsOn.length > 0) {
            entry.dependsOn = convertDependsOn(task.dependsOn);
        }

        if (task.inputs && task.inputs.length > 0) {
            entry.inputs = task.inputs;
        }

        if (task.outputs && task.outputs.length > 0) {
            entry.outputs = task.outputs;
        }

        if (Object.keys(options).length > 0) {
            entry.options = options;
        }

        targetDefaults[taskName] = entry;
    }

    const configObject: Record<string, unknown> = {};

    if (Object.keys(targetDefaults).length > 0) {
        configObject.targetDefaults = targetDefaults;
    }

    if (turbo.globalDependencies && turbo.globalDependencies.length > 0) {
        configObject.taskRunnerOptions = {
            globalInputs: turbo.globalDependencies,
            ...(turbo.globalEnv && turbo.globalEnv.length > 0 ? { globalEnv: turbo.globalEnv } : {}),
        };
    } else if (turbo.globalEnv && turbo.globalEnv.length > 0) {
        configObject.taskRunnerOptions = { globalEnv: turbo.globalEnv };
    }

    const serialised = JSON.stringify(configObject, null, 4)
        // Unquote keys so the emitted file looks like idiomatic TS.
        .replaceAll(/"(\w+)":/g, "$1:");

    return [
        "// Migrated from turbo.json by `vis migrate turborepo`.",
        "// Review the generated targetDefaults and move project-specific tasks",
        "// into each project's project.json.",
        "",
        "import { defineConfig } from \"@visulima/vis/config\";",
        "",
        `export default defineConfig(${serialised});`,
        "",
    ].join("\n");
};

/**
 * Runs the turborepo → vis migration. Reads `turbo.json` from the
 * workspace root and writes `vis.config.ts`. Non-destructive: the
 * original turbo.json is left in place for review.
 */
export const migrateTurborepo = (
    workspaceRoot: string,
    options: { dryRun?: boolean } = {},
    logger: Logger,
    report: MigrationReport,
): void => {
    const turboPath = join(workspaceRoot, "turbo.json");

    if (!existsSync(turboPath)) {
        logger.warn("No turbo.json found in workspace root — nothing to migrate.");
        report.warnings.push("No turbo.json at workspace root.");

        return;
    }

    let turbo: TurboJson;

    try {
        turbo = JSON.parse(readFileSync(turboPath, "utf8")) as TurboJson;
    } catch (error) {
        throw new Error(`Failed to parse ${turboPath}: ${(error as Error).message}`);
    }

    const visConfigPath = join(workspaceRoot, "vis.config.ts");

    if (existsSync(visConfigPath) && !options.dryRun) {
        logger.warn("vis.config.ts already exists — refusing to overwrite. Remove it first or run with --dry-run.");
        report.warnings.push("vis.config.ts already exists; migration skipped writing the file.");

        return;
    }

    const rendered = renderVisConfig(turbo);

    if (options.dryRun) {
        logger.info("── vis.config.ts (preview) ──");
        logger.info(rendered);
        logger.info("── end preview ──");
    } else {
        writeFileSync(visConfigPath, rendered);
        logger.info(`Wrote ${visConfigPath}`);
    }

    report.manualSteps.push(
        "Review targetDefaults in vis.config.ts — project-specific tasks (turbo's project#task syntax) were skipped and should be moved into each project's project.json.",
    );

    if (turbo.remoteCache?.enabled) {
        report.manualSteps.push(
            "turbo remote cache detected. vis speaks the same HTTP protocol — set taskRunnerOptions.remoteCache { url, token, teamId } in vis.config.ts.",
        );
    }
};
