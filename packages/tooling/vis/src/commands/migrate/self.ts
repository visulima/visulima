import { isAccessibleSync, readFileSync, walkSync, writeFileSync } from "@visulima/fs";
import { basename, join } from "@visulima/path";

import { backupFile } from "./backup";
import type { MigrateLogger, MigrationReport } from "./types";

/**
 * Source-level renames applied by `vis migrate self` to bring an old
 * `vis.config.ts` up to the current schema. Order matters — longer/more
 * specific keys must precede their substrings so the substring rule
 * doesn't fire first and break the longer one. We use word-boundary
 * regexes so an unrelated `targetDefaults` substring inside a string
 * literal won't be rewritten.
 */
interface KeyRename {
    /** Where the key appears — used to scope the regex (only object keys). */
    description: string;
    /** Replacement key name. */
    next: string;
    /** Removed key name. */
    previous: string;
}

const CONFIG_KEY_RENAMES: ReadonlyArray<KeyRename> = [
    { description: "VisConfig.targetDefaults → VisConfig.tasks", next: "tasks", previous: "targetDefaults" },
    { description: "VisConfig.taskDefaults → VisConfig.scopedTasks", next: "scopedTasks", previous: "taskDefaults" },
    { description: "VisConfig.taskRunnerOptions → VisConfig.taskRunner", next: "taskRunner", previous: "taskRunnerOptions" },
    { description: "ScopedTasksBlock.scope → ScopedTasksBlock.match", next: "match", previous: "scope" },
    { description: "ScopedTasksBlock.targets → ScopedTasksBlock.tasks", next: "tasks", previous: "targets" },
];

const TASK_KEY_RENAMES: ReadonlyArray<KeyRename> = [{ description: "VisTaskConfig.targets → VisTaskConfig.tasks", next: "tasks", previous: "targets" }];

/**
 * Build a regex that matches an unquoted or quoted object key. Matches:
 *   `  foo:`          (identifier key)
 *   `  "foo":`        (string key)
 *   `  'foo':`        (string key)
 * but NOT `foo` inside a string literal that's a value, because the
 * trailing `:` lookahead rules those out.
 */
const buildKeyRegex = (name: string): RegExp => new RegExp(String.raw`(^|[\s,{(\[])(["']?)${name}\2(\s*:)`, "gmu");

const applyRenames = (source: string, renames: ReadonlyArray<KeyRename>): { applied: KeyRename[]; output: string } => {
    let output = source;
    const applied: KeyRename[] = [];

    for (const rename of renames) {
        const regex = buildKeyRegex(rename.previous);

        if (regex.test(output)) {
            // Reset lastIndex — `test` advanced it on the stateful regex.
            regex.lastIndex = 0;
            output = output.replace(regex, (_match, before: string, quote: string, after: string) => `${before}${quote}${rename.next}${quote}${after}`);
            applied.push(rename);
        }
    }

    return { applied, output };
};

/**
 * Rewrite a single file using the supplied rename table. Returns the new
 * content and the list of renames that matched. No file IO is done here
 * — callers decide whether to write back.
 */
export const rewriteSource = (source: string, renames: ReadonlyArray<KeyRename>): { applied: KeyRename[]; output: string } => applyRenames(source, renames);

/**
 * File-discovery helper: returns the path to the workspace `vis.config.ts`
 * (or its `.mts/.cts/.js/.mjs/.cjs` variants), or `undefined` if none.
 */
const CONFIG_FILENAMES = ["vis.config.ts", "vis.config.mts", "vis.config.cts", "vis.config.js", "vis.config.mjs", "vis.config.cjs"];
const TASK_CONFIG_BASENAMES = new Set(["vis.task.cjs", "vis.task.cts", "vis.task.js", "vis.task.mjs", "vis.task.mts", "vis.task.ts"]);

const findConfigFile = (workspaceRoot: string): string | undefined => {
    for (const name of CONFIG_FILENAMES) {
        const candidate = join(workspaceRoot, name);

        if (isAccessibleSync(candidate)) {
            return candidate;
        }
    }

    return undefined;
};

/**
 * Walk the workspace for `vis.task.{ts,mts,cts,js,mjs,cjs}` overlays.
 * Skips `node_modules`, `.git`, and common output directories so a large
 * monorepo doesn't pay for a full tree scan.
 */
const findTaskConfigFiles = (workspaceRoot: string): string[] => {
    const results: string[] = [];

    try {
        for (const entry of walkSync(workspaceRoot, {
            includeDirs: false,
            includeFiles: true,
            includeSymlinks: false,
            skip: [/node_modules/, /\.git/, /\.vis\b/, /dist\b/, /\.next\b/, /\.nuxt\b/],
        })) {
            if (TASK_CONFIG_BASENAMES.has(basename(entry.path))) {
                results.push(entry.path);
            }
        }
    } catch {
        // Best-effort: a directory we can't read just means we yield fewer paths.
    }

    return results;
};

/**
 * Rewrite the workspace `vis.config.ts` and every discovered
 * `vis.task.ts` overlay to use the current field names.
 *
 * In dry-run mode, prints the proposed file content but writes nothing.
 * Otherwise creates a `.bak` next to each modified file before writing.
 * @param workspaceRoot Absolute workspace root path.
 * @param options Migration options.
 * @param options.dryRun When true, preview without writing.
 * @param options.taskConfigPaths Optional override of the discovered list; primarily for tests.
 * @param logger Logger for user feedback.
 * @param report Migration report to append outcomes to.
 */
export const migrateSelf = (
    workspaceRoot: string,
    options: { dryRun?: boolean; taskConfigPaths?: ReadonlyArray<string> },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const visConfigPath = findConfigFile(workspaceRoot);

    if (visConfigPath) {
        const original = readFileSync(visConfigPath);
        const { applied, output } = rewriteSource(original, CONFIG_KEY_RENAMES);

        if (applied.length === 0) {
            logger.info(`${visConfigPath} already uses the current schema — no rewrite needed.`);
        } else if (options.dryRun) {
            logger.info(`── ${visConfigPath} (preview) ──`);
            logger.info(output);
            logger.info("── end preview ──");
            logger.info(`Would apply ${String(applied.length)} rename(s): ${applied.map((r) => r.description).join(", ")}`);
        } else {
            backupFile(visConfigPath, report);
            writeFileSync(visConfigPath, output);
            logger.info(`Rewrote ${visConfigPath} (backup at ${visConfigPath}.bak). Applied ${String(applied.length)} rename(s).`);

            for (const rename of applied) {
                report.manualSteps.push(`Renamed ${rename.description} in ${visConfigPath}`);
            }
        }
    } else {
        logger.warn("No vis.config.ts found at workspace root — nothing to migrate.");
        report.warnings.push("No vis.config.{ts,mts,cts,js,mjs,cjs} at workspace root.");
    }

    const taskPaths = options.taskConfigPaths ?? findTaskConfigFiles(workspaceRoot);

    for (const taskPath of taskPaths) {
        if (!isAccessibleSync(taskPath)) {
            continue;
        }

        const taskSource = readFileSync(taskPath);
        const taskResult = rewriteSource(taskSource, TASK_KEY_RENAMES);

        if (taskResult.applied.length === 0) {
            continue;
        }

        if (options.dryRun) {
            logger.info(`── ${taskPath} (preview) ──`);
            logger.info(taskResult.output);
            logger.info("── end preview ──");
            logger.info(`Would apply ${String(taskResult.applied.length)} rename(s): ${taskResult.applied.map((r) => r.description).join(", ")}`);
        } else {
            backupFile(taskPath, report);
            writeFileSync(taskPath, taskResult.output);
            logger.info(`Rewrote ${taskPath} (backup at ${taskPath}.bak). Applied ${String(taskResult.applied.length)} rename(s).`);

            for (const rename of taskResult.applied) {
                report.manualSteps.push(`Renamed ${rename.description} in ${taskPath}`);
            }
        }
    }
};
