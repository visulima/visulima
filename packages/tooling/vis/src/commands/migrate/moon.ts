import { readdirSync } from "node:fs";

import { isAccessibleSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

import { serializeConfigObject, writeVisConfig } from "./shared";
import type { MigrateLogger, MigrationReport } from "./types";

// ── Moon config shape ────────────────────────────────────────────────

interface MoonTaskYaml {
    args?: string | string[];
    command?: string;
    deps?: string[];
    env?: Record<string, string>;
    inputs?: string[];
    options?: Record<string, unknown>;
    outputs?: string[];
    platform?: string;
    preset?: string;
    toolchain?: string;
    type?: string;
}

interface MoonTasksYaml {
    extends?: string[];
    fileGroups?: Record<string, string[]>;
    implicitDeps?: string[];
    implicitInputs?: string[];
    taskOptions?: Record<string, unknown>;
    tasks?: Record<string, MoonTaskYaml>;
}

// ── Conversion ───────────────────────────────────────────────────────

const taskToVisTarget = (task: MoonTaskYaml): Record<string, unknown> => {
    const target: Record<string, unknown> = {};

    if (task.command) {
        target.command = Array.isArray(task.args) ? `${task.command} ${task.args.join(" ")}` : task.args ? `${task.command} ${task.args}` : task.command;
    }

    if (task.deps && task.deps.length > 0) {
        target.dependsOn = task.deps;
    }

    if (task.inputs && task.inputs.length > 0) {
        target.inputs = task.inputs;
    }

    if (task.outputs && task.outputs.length > 0) {
        target.outputs = task.outputs;
    }

    if (task.type) {
        target.type = task.type;
    }

    if (task.preset) {
        target.preset = task.preset;
    }

    if (task.options) {
        target.options = task.options;
    }

    return target;
};

const renderVisConfig = (tasks: MoonTasksYaml): string => {
    const configObject: Record<string, unknown> = {};

    if (tasks.fileGroups) {
        configObject.fileGroups = tasks.fileGroups;
    }

    const targetDefaults: Record<string, Record<string, unknown>> = {};

    for (const [name, task] of Object.entries(tasks.tasks ?? {})) {
        targetDefaults[name] = taskToVisTarget(task);
    }

    if (Object.keys(targetDefaults).length > 0) {
        configObject.targetDefaults = targetDefaults;
    }

    if (tasks.implicitInputs && tasks.implicitInputs.length > 0) {
        configObject.namedInputs = { default: tasks.implicitInputs };
    }

    const serialised = serializeConfigObject(configObject);

    return [
        "// Migrated from moon's .moon/tasks.yml by `vis migrate moon`.",
        "// Per-project moon.yml files can be converted to project.json —",
        "// review the generated file and move project-specific tasks there.",
        "",
        'import { defineConfig } from "@visulima/vis/config";',
        "",
        `export default defineConfig(${serialised});`,
        "",
    ].join("\n");
};

// ── Moon file discovery ──────────────────────────────────────────────

const findMoonTasksFile = (workspaceRoot: string): string | undefined => {
    const moonDir = join(workspaceRoot, ".moon");

    if (!isAccessibleSync(moonDir)) {
        return undefined;
    }

    for (const name of ["tasks.yml", "tasks.yaml"]) {
        const filePath = join(moonDir, name);

        if (isAccessibleSync(filePath)) {
            return filePath;
        }
    }

    const tasksDir = join(moonDir, "tasks");

    if (isAccessibleSync(tasksDir)) {
        const entries = readdirSync(tasksDir)
            .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
            .sort();

        if (entries.length > 0) {
            return join(tasksDir, entries[0]!);
        }
    }

    return undefined;
};

// ── Migration entry ──────────────────────────────────────────────────

/**
 * Translates a moon `.moon/tasks.yml` into a `vis.config.ts`.
 * @param workspaceRoot Absolute workspace root path.
 * @param options Migration options.
 * @param logger Logger for user feedback.
 * @param report Migration report to append manual steps and warnings.
 */
export const migrateMoon = (workspaceRoot: string, options: { dryRun?: boolean }, logger: MigrateLogger, report: MigrationReport): void => {
    const tasksFile = findMoonTasksFile(workspaceRoot);

    if (!tasksFile) {
        logger.warn("No .moon/tasks.yml (or .moon/tasks/<scope>.yml) found — nothing to migrate.");
        report.warnings.push("No moon tasks file at workspace root.");

        return;
    }

    let parsed: MoonTasksYaml;

    try {
        parsed = readYamlSync(tasksFile) as MoonTasksYaml;
    } catch (error) {
        throw new Error(`Failed to parse ${tasksFile}: ${(error as Error).message}`);
    }

    // Warn about fields that vis does not support directly.
    for (const [name, task] of Object.entries(parsed.tasks ?? {})) {
        if (task.env && Object.keys(task.env).length > 0) {
            report.warnings.push(
                `Task "${name}" has an \`env\` block which vis does not support — set environment variables in the command or a wrapper script.`,
            );
        }

        if (task.platform) {
            report.warnings.push(`Task "${name}" has a \`platform\` field ("${task.platform}") which vis does not support — review and remove.`);
        }

        if (task.toolchain) {
            report.warnings.push(`Task "${name}" has a \`toolchain\` field ("${task.toolchain}") which vis does not support — review and remove.`);
        }

        const hasArgsWithSpaces = Array.isArray(task.args) && task.args.some((a) => a.includes(" "));

        if (hasArgsWithSpaces) {
            report.warnings.push(
                `Task "${name}" has \`args\` entries containing spaces — vis flattens args into the command string so quoting may need manual adjustment.`,
            );
        }
    }

    if (parsed.extends && parsed.extends.length > 0) {
        report.warnings.push(
            "`extends` was found in the moon config but has no direct vis equivalent — inline the referenced files or use vis's `taskDefaults` blocks.",
        );
    }

    if (parsed.implicitDeps && parsed.implicitDeps.length > 0) {
        report.warnings.push(
            "`implicitDeps` was found in the moon config but has no direct vis equivalent — add explicit `dependsOn` entries in project.json instead.",
        );
    }

    if (parsed.taskOptions && Object.keys(parsed.taskOptions).length > 0) {
        report.warnings.push(
            "`taskOptions` was found in the moon config but has no direct vis equivalent — review and apply settings per-target in vis.config.ts.",
        );
    }

    const rendered = renderVisConfig(parsed);

    if (!writeVisConfig(workspaceRoot, rendered, options, logger, report)) {
        return;
    }

    report.manualSteps.push(
        "moon's per-project `moon.yml` files should be converted to `project.json`. vis reads targets, tags, layer, stack, language, and owners from project.json — the field names match.",
    );
    report.manualSteps.push(
        "Scoped `.moon/tasks/<scope>.yml` files map to vis's `taskDefaults` with a `scope` block. Only the first scope file was parsed — review the generated file.",
    );
};
