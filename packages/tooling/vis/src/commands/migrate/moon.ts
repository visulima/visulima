import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { MigrationReport } from "./types";

interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

/**
 * moon ships YAML configuration files. Rather than pulling in a full
 * YAML parser, we use a deliberately tiny subset parser that only
 * understands the moon task/project config shapes. This is enough for
 * a migration pass and keeps us dependency-free.
 *
 * If the input is more complex than we can parse, we emit a `warning`
 * into the migration report so the user knows to finish the port by
 * hand — we never silently lose fields.
 */

// ── Tiny YAML parser ─────────────────────────────────────────────────

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

const LINE_RE = /^(\s*)([^\s].*?)(?:\s*#.*)?$/;
const QUOTED_RE = /^(['"])(.*)\1$/;

const parseScalar = (raw: string): YamlValue => {
    const trimmed = raw.trim();

    if (trimmed === "") {
        return "";
    }

    if (trimmed === "true") {
        return true;
    }

    if (trimmed === "false") {
        return false;
    }

    if (trimmed === "null" || trimmed === "~") {
        return null;
    }

    if (QUOTED_RE.test(trimmed)) {
        return trimmed.slice(1, -1);
    }

    const asNumber = Number(trimmed);

    if (!Number.isNaN(asNumber) && /^-?\d/.test(trimmed)) {
        return asNumber;
    }

    return trimmed;
};

/** Parses a minimal indentation-driven YAML subset into JS values. */
export const parseTinyYaml = (input: string): YamlValue => {
    const rawLines = input.split(/\r?\n/);
    const lines: { indent: number; content: string }[] = [];

    for (const raw of rawLines) {
        const match = LINE_RE.exec(raw);

        if (!match) {
            continue;
        }

        const [, indent, content] = match;

        lines.push({ content: content!, indent: indent!.length });
    }

    let index = 0;

    const parseBlock = (currentIndent: number): YamlValue => {
        // Inspect the first meaningful line at or beyond currentIndent.
        if (index >= lines.length) {
            return null;
        }

        const first = lines[index]!;

        if (first.indent < currentIndent) {
            return null;
        }

        if (first.content.startsWith("- ")) {
            const array: YamlValue[] = [];

            while (index < lines.length) {
                const line = lines[index]!;

                if (line.indent < currentIndent) {
                    break;
                }

                if (line.indent !== currentIndent) {
                    break;
                }

                if (!line.content.startsWith("- ")) {
                    break;
                }

                const afterDash = line.content.slice(2).trim();

                if (afterDash.includes(":") && !afterDash.endsWith(":") && !QUOTED_RE.test(afterDash)) {
                    // Inline object after `- `
                    const [k, v] = afterDash.split(":").map((s) => s.trim());

                    array.push({ [k!]: parseScalar(v!) });
                    index++;
                } else {
                    array.push(parseScalar(afterDash));
                    index++;
                }
            }

            return array;
        }

        const object: Record<string, YamlValue> = {};

        while (index < lines.length) {
            const line = lines[index]!;

            if (line.indent < currentIndent) {
                break;
            }

            if (line.indent !== currentIndent) {
                index++;
                continue;
            }

            const colonIndex = line.content.indexOf(":");

            if (colonIndex === -1) {
                index++;
                continue;
            }

            const key = line.content.slice(0, colonIndex).trim();
            const rest = line.content.slice(colonIndex + 1).trim();

            if (rest === "") {
                index++;

                // Nested block follows.
                const nextIndent = lines[index]?.indent ?? currentIndent;

                if (nextIndent > currentIndent) {
                    object[key] = parseBlock(nextIndent);
                } else {
                    object[key] = null;
                }
            } else {
                object[key] = parseScalar(rest);
                index++;
            }
        }

        return object;
    };

    return parseBlock(0);
};

// ── Moon shape → vis shape ───────────────────────────────────────────

interface MoonTaskYaml {
    command?: string;
    args?: string | string[];
    deps?: string[];
    inputs?: string[];
    outputs?: string[];
    env?: Record<string, string>;
    platform?: string;
    toolchain?: string;
    preset?: string;
    type?: string;
    options?: Record<string, unknown>;
}

interface MoonTasksYaml {
    extends?: string[];
    fileGroups?: Record<string, string[]>;
    implicitDeps?: string[];
    implicitInputs?: string[];
    tasks?: Record<string, MoonTaskYaml>;
    taskOptions?: Record<string, unknown>;
}

const taskToVisTarget = (task: MoonTaskYaml): Record<string, unknown> => {
    const target: Record<string, unknown> = {};

    if (task.command) {
        target.command = Array.isArray(task.args)
            ? `${task.command} ${task.args.join(" ")}`
            : task.args
                ? `${task.command} ${task.args}`
                : task.command;
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
        // moon's options map one-to-one to vis's options — they share
        // the same field names (persistent, interactive, internal,
        // runInCI, retryCount, affectedFiles, mutex, envFile, osType, …).
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

    const serialised = JSON.stringify(configObject, null, 4)
        .replaceAll(/"(\w+)":/g, "$1:");

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

    if (!existsSync(moonDir)) {
        return undefined;
    }

    const candidates = ["tasks.yml", "tasks.yaml"];

    for (const name of candidates) {
        const filePath = join(moonDir, name);

        if (existsSync(filePath)) {
            return filePath;
        }
    }

    // Scoped tasks directory: .moon/tasks/<scope>.yml
    const tasksDir = join(moonDir, "tasks");

    if (existsSync(tasksDir)) {
        const entries = readdirSync(tasksDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

        if (entries.length > 0) {
            return join(tasksDir, entries[0]!);
        }
    }

    return undefined;
};

export const migrateMoon = (
    workspaceRoot: string,
    options: { dryRun?: boolean } = {},
    logger: Logger,
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
        const raw = readFileSync(tasksFile, "utf8");
        const data = parseTinyYaml(raw);

        parsed = (typeof data === "object" && data !== null && !Array.isArray(data) ? data : {}) as MoonTasksYaml;
    } catch (error) {
        throw new Error(`Failed to parse ${tasksFile}: ${(error as Error).message}`);
    }

    const visConfigPath = join(workspaceRoot, "vis.config.ts");

    if (existsSync(visConfigPath) && !options.dryRun) {
        logger.warn("vis.config.ts already exists — refusing to overwrite. Remove it first or run with --dry-run.");
        report.warnings.push("vis.config.ts already exists; migration skipped writing the file.");

        return;
    }

    const rendered = renderVisConfig(parsed);

    if (options.dryRun) {
        logger.info("── vis.config.ts (preview) ──");
        logger.info(rendered);
        logger.info("── end preview ──");
    } else {
        writeFileSync(visConfigPath, rendered);
        logger.info(`Wrote ${visConfigPath}`);
    }

    report.manualSteps.push(
        "moon's per-project `moon.yml` files should be converted to `project.json`. vis reads targets, tags, layer, stack, language, and owners from project.json — the field names match.",
    );
    report.manualSteps.push(
        "Scoped `.moon/tasks/<scope>.yml` files map to vis's `taskDefaults` with a `scope` block. Only the first scope file was parsed — review the generated file.",
    );
};
