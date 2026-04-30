import { readJsonConfig, serializeConfigObject, writeVisConfig } from "./shared";
import type { MigrateLogger, MigrationReport } from "./types";

interface TurboJson {
    extends?: string[];
    globalDependencies?: string[];
    globalEnv?: string[];
    globalPassThroughEnv?: string[];
    pipeline?: Record<string, TurboTask>;
    remoteCache?: {
        apiUrl?: string;
        enabled?: boolean;
        signature?: boolean;
        teamId?: string;
    };
    tasks?: Record<string, TurboTask>;
    ui?: "stream" | "tui";
}

interface TurboTask {
    cache?: boolean;
    dependsOn?: string[];
    env?: string[];
    inputs?: string[];
    interactive?: boolean;
    outputLogs?: "errors-only" | "full" | "hash-only" | "new-only" | "none";
    outputs?: string[];
    passThroughEnv?: string[];
    persistent?: boolean;
}

const convertDependsOn = (deps: string[]): (string | { dependencies?: boolean; projects?: string | string[]; target: string })[] =>
    deps.map((dep) => {
        if (dep.startsWith("^")) {
            return { dependencies: true, target: dep.slice(1) };
        }

        if (dep.includes("#")) {
            const [project, target] = dep.split("#");

            return { projects: project, target: target! };
        }

        return dep;
    });

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

        if (task.env && task.env.length > 0) {
            entry.env = task.env;
        }

        if (task.passThroughEnv && task.passThroughEnv.length > 0) {
            entry.passThroughEnv = task.passThroughEnv;
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

    const taskRunnerOptions: Record<string, unknown> = {};

    if (turbo.globalDependencies && turbo.globalDependencies.length > 0) {
        taskRunnerOptions.globalInputs = turbo.globalDependencies;
    }

    if (turbo.globalEnv && turbo.globalEnv.length > 0) {
        taskRunnerOptions.globalEnv = turbo.globalEnv;
    }

    if (turbo.globalPassThroughEnv && turbo.globalPassThroughEnv.length > 0) {
        taskRunnerOptions.globalPassThroughEnv = turbo.globalPassThroughEnv;
    }

    if (Object.keys(taskRunnerOptions).length > 0) {
        configObject.taskRunnerOptions = taskRunnerOptions;
    }

    const serialised = serializeConfigObject(configObject);

    return [
        "// Migrated from turbo.json by `vis migrate turborepo`.",
        "// Review the generated targetDefaults and move project-specific tasks",
        "// into each project's project.json.",
        "",
        'import { defineConfig } from "@visulima/vis/config";',
        "",
        `export default defineConfig(${serialised});`,
        "",
    ].join("\n");
};

/**
 * Translates a `turbo.json` into a `vis.config.ts`.
 * @param workspaceRoot Absolute workspace root path.
 * @param options Migration options.
 * @param logger Logger for user feedback.
 * @param report Migration report to append manual steps and warnings.
 */
export const migrateTurborepo = (workspaceRoot: string, options: { dryRun?: boolean }, logger: MigrateLogger, report: MigrationReport): void => {
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
    report.manualSteps.push(
        "vis adds two task primitives turbo doesn't have: `when: { os, env, branch, ci, not.* }` for conditional execution and `always: true` for finally/teardown tasks that run even when upstream fails. See docs/guides/conditional-and-finally-tasks.mdx.",
    );

    const tasks = turbo.tasks ?? turbo.pipeline ?? {};

    const hasOutputLogs = Object.values(tasks).some((t) => t.outputLogs !== undefined);

    if (hasOutputLogs) {
        report.warnings.push("`outputLogs` was found on one or more tasks but vis has no equivalent setting — review and remove.");
    }

    if (turbo.remoteCache?.enabled) {
        report.manualSteps.push(
            "turbo remote cache detected. vis speaks the same HTTP protocol — set taskRunnerOptions.remoteCache { url, token, teamId } in vis.config.ts.",
        );
    }
};
