import { cpSync, mkdirSync, readdirSync } from "node:fs";

import { isAccessibleSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

import { serializeConfigObject, writeVisConfig } from "./shared";
import type { MigrateLogger, MigrationReport } from "./types";

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

const renderVisConfig = (tasks: MoonTasksYaml, workspaceRoot: string, useEditorconfig?: boolean): string => {
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

    const serialised = serializeConfigObject(configObject, join(workspaceRoot, "vis.config.ts"), useEditorconfig);

    return [
        "// Migrated from moon's .moon/tasks.yml by `vis migrate moon`.",
        "// Per-project moon.yml files can be converted to project.json —",
        "// review the generated file and move project-specific tasks there.",
        "",
        "import { defineConfig } from \"@visulima/vis/config\";",
        "",
        `export default defineConfig(${serialised});`,
        "",
    ].join("\n");
};

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

/**
 * Translates a moon `.moon/tasks.yml` into a `vis.config.ts`.
 * @param workspaceRoot Absolute workspace root path.
 * @param options Migration options.
 * @param logger Logger for user feedback.
 * @param report Migration report to append manual steps and warnings.
 */

/**
 * Enumerate the moon template directories (each containing a
 * `template.yml`). Returns an empty list when `.moon/templates/`
 * doesn't exist — callers should treat that as "no templates to
 * migrate", not an error.
 */
const findMoonTemplates = (workspaceRoot: string): string[] => {
    const moonTemplatesDirectory = join(workspaceRoot, ".moon", "templates");

    if (!isAccessibleSync(moonTemplatesDirectory)) {
        return [];
    }

    const names: string[] = [];

    try {
        for (const entry of readdirSync(moonTemplatesDirectory, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                continue;
            }

            if (isAccessibleSync(join(moonTemplatesDirectory, entry.name, "template.yml"))) {
                names.push(entry.name);
            }
        }
    } catch {
        // Unreadable directory — fall through to an empty result.
    }

    return names.sort();
};

/**
 * Copy each `.moon/templates/&lt;name>/` into `.vis/templates/&lt;name>/`.
 * Skips when the target already exists; logs each decision via
 * `report.manualSteps` so the user can review.
 */
const copyMoonTemplatesToVis = (workspaceRoot: string, names: string[], dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const moonRoot = join(workspaceRoot, ".moon", "templates");
    const visRoot = join(workspaceRoot, ".vis", "templates");

    if (!dryRun) {
        mkdirSync(visRoot, { recursive: true });
    }

    for (const name of names) {
        const source = join(moonRoot, name);
        const target = join(visRoot, name);

        if (isAccessibleSync(target)) {
            report.warnings.push(`Template "${name}" already exists at .vis/templates/${name} — left untouched. Remove or rename either copy to resolve.`);
            continue;
        }

        if (dryRun) {
            logger.info(`Would copy .moon/templates/${name} → .vis/templates/${name}`);
            continue;
        }

        try {
            cpSync(source, target, { recursive: true });
            logger.info(`Copied .moon/templates/${name} → .vis/templates/${name}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            report.warnings.push(`Failed to copy template "${name}": ${message}`);
        }
    }

    if (!dryRun && names.length > 0) {
        report.manualSteps.push(
            `Copied ${String(names.length)} template${names.length === 1 ? "" : "s"} from .moon/templates/ to .vis/templates/. Remove the .moon/templates/ directory when ready.`,
        );
    }
};

export const migrateMoon = (
    workspaceRoot: string,
    options: { copyTemplates?: boolean; dryRun?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const tasksFile = findMoonTasksFile(workspaceRoot);

    if (!tasksFile) {
        logger.warn("No .moon/tasks.yml (or .moon/tasks/<scope>.yml) found — nothing to migrate.");
        report.warnings.push("No moon tasks file at workspace root.");

        return;
    }

    let parsed: MoonTasksYaml;

    try {
        parsed = readYamlSync(tasksFile);
    } catch (error) {
        throw new Error(`Failed to parse ${tasksFile}: ${(error as Error).message}`, { cause: error });
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

    const rendered = renderVisConfig(parsed, workspaceRoot, options.useEditorconfig);

    if (!writeVisConfig(workspaceRoot, rendered, options, logger, report)) {
        return;
    }

    report.manualSteps.push(
        "moon's per-project `moon.yml` files should be converted to `project.json`. vis reads targets, tags, layer, stack, language, and owners from project.json — the field names match.",
    );
    report.manualSteps.push(
        "Scoped `.moon/tasks/<scope>.yml` files map to vis's `taskDefaults` with a `scope` block. Only the first scope file was parsed — review the generated file.",
    );
    report.manualSteps.push(
        "vis tasks support `when: { os, env, branch, ci, not.* }` for conditional execution and `always: true` for cleanup tasks that fire even when upstream fails. Review tasks that used moon's `local: true`, `options.runInCI`, or shell-based platform gating — the new surface is more expressive and may simplify them. See docs/guides/conditional-and-finally-tasks.mdx.",
    );

    // `.moon/templates/` auto-discovers in `vis generate` with no config
    // change needed, so for most users the migration is zero-effort.
    // Still, call it out explicitly so the user knows. `--copy-templates`
    // physically moves them into `.vis/templates/` for users who want to
    // uninstall moon.
    const templates = findMoonTemplates(workspaceRoot);

    if (templates.length === 0) {
        return;
    }

    const list = templates.map((n) => `"${n}"`).join(", ");

    if (options.copyTemplates) {
        copyMoonTemplatesToVis(workspaceRoot, templates, Boolean(options.dryRun), logger, report);
    } else {
        report.manualSteps.push(
            `Detected ${String(templates.length)} template${templates.length === 1 ? "" : "s"} under .moon/templates/ (${list}). `
            + "They are already usable via `vis generate <name>` — vis auto-discovers moon-format template directories at runtime. "
            + "To decouple from moon entirely, re-run `vis migrate moon --copy-templates` to physically move them to .vis/templates/.",
        );
    }
};
