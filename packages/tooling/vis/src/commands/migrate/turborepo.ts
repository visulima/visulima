import type { MigrateLogger, MigrationReport } from "./types";
import { readJsonConfig, serializeConfigObject, writeVisConfig } from "./shared";

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
    outputLogs?: "errors-only" | "full" | "hash-only" | "new-only" | "none";
    passThroughEnv?: string[];
}

const convertDependsOn = (deps: string[]): (string | { dependencies?: boolean; projects?: string | string[]; target: string })[] => {
    return deps.map((dep) => {
        if (dep.startsWith("^")) {
            return { dependencies: true, target: dep.slice(1) };
        }

        if (dep.includes("#")) {
            const [project, target] = dep.split("#");

            return { projects: project, target: target! };
        }

        return dep;
    });
};

const renderVisConfig = (turbo: TurboJson): string => {
    const tasks = turbo.tasks ?? turbo.pipeline ?? {};
    const targetDefaults: Record<string, Record<string, unknown>> = {};

    for (const [taskName, task] of Object.entries(tasks)) {
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

    const serialised = serializeConfigObject(configObject);

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
 * Translates a `turbo.json` into a `vis.config.ts`.
 *
 * @param workspaceRoot - Absolute workspace root path.
 * @param options - Migration options.
 * @param logger - Logger for user feedback.
 * @param report - Migration report to append manual steps and warnings.
 */
export const migrateTurborepo = (
    workspaceRoot: string,
    options: { dryRun?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const turbo = readJsonConfig<TurboJson>(workspaceRoot, "turbo.json");

    if (!turbo) {
        logger.warn("No turbo.json found in workspace root — nothing to migrate.");
        report.warnings.push("No turbo.json at workspace root.");

        return;
    }

    const rendered = renderVisConfig(turbo);

    if (!writeVisConfig(workspaceRoot, rendered, options, logger, report)) {
        return;
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
