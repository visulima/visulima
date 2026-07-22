import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { resolveIndentForFile } from "../../util/editorconfig";
import { backupFile } from "./backup";
import type { MigrateLogger, MigrationReport } from "./types";

/**
 * Serialises a config object to a pretty-printed TypeScript string with
 * unquoted keys (idiomatic TS style). When `filePath` is provided, the
 * indent is derived from that path's `.editorconfig` (4 spaces if none),
 * unless `useEditorconfig` is `false`.
 * @param obj The configuration object to serialise.
 * @param filePath Destination path; used purely for `.editorconfig` lookup.
 * @param useEditorconfig When `false`, skip `.editorconfig` discovery.
 * @returns A JSON string with keys unquoted for TS readability.
 */
export const serializeConfigObject = (obj: Record<string, unknown>, filePath?: string, useEditorconfig?: boolean): string => {
    const indent = filePath ? resolveIndentForFile(filePath, undefined, { defaultIndent: "    ", useEditorconfig }) : "    ";

    return JSON.stringify(obj, null, indent).replaceAll(/"(\w+)":/g, "$1:");
};

/** Matches the opening `defineConfig({` of a vis config so a block can be inserted right after it. */
export const DEFINE_CONFIG_RE = /(defineConfig\(\{)/;

/** Matches a plain `export default {` config so a block can be inserted right after it. */
export const EXPORT_DEFAULT_RE = /(export\s+default\s+\{)/;

/**
 * Insert a pre-indented `key: value` block immediately after the config
 * object's opening brace (`defineConfig({` or `export default {`). Returns
 * the updated content, or `undefined` when neither anchor is present.
 * @param content The current `vis.config.ts` source.
 * @param snippet A pre-indented block (e.g. `    tasks: {\n        ...\n    }`).
 * @returns The updated source, or `undefined` if no insertion anchor exists.
 */
export const insertBlockIntoVisConfig = (content: string, snippet: string): string | undefined => {
    if (DEFINE_CONFIG_RE.test(content)) {
        return content.replace(DEFINE_CONFIG_RE, `$1\n${snippet},`);
    }

    if (EXPORT_DEFAULT_RE.test(content)) {
        return content.replace(EXPORT_DEFAULT_RE, `$1\n${snippet},`);
    }

    return undefined;
};

/**
 * Serialise a single `key: value` config entry into a block ready to be
 * inserted after `defineConfig({`. The outer braces produced by
 * {@link serializeConfigObject} are stripped, leaving the indented inner line(s).
 * @param key The config key (e.g. `tasks`).
 * @param value The value to serialise.
 * @param filePath Destination path; used purely for `.editorconfig` indent lookup.
 * @param useEditorconfig When `false`, skip `.editorconfig` discovery.
 * @returns A pre-indented `key: value` block (no trailing comma).
 */
export const renderConfigKeySnippet = (key: string, value: unknown, filePath?: string, useEditorconfig?: boolean): string => {
    const serialised = serializeConfigObject({ [key]: value }, filePath, useEditorconfig);
    const lines = serialised.split("\n");

    // Drop the wrapping `{` and `}` lines, keep the already-indented middle.
    return lines.slice(1, -1).join("\n");
};

/** Outcome of {@link mergeOrWriteVisConfig}, for the caller's reporting. */
export type VisConfigWriteOutcome = "merged" | "preview" | "skipped" | "written";

/**
 * Write, overwrite, or merge a migrated config into `vis.config.ts`.
 *
 * Unlike {@link writeVisConfig} — which refuses when the file exists — this
 * merges each top-level key that the existing file does not already define
 * (inserting it after `defineConfig({`), and leaves any key the file already
 * defines untouched, surfacing it as a warning + manual step so the user (or
 * the AI handoff) can reconcile it. A `.bak` is taken before any mutation.
 * @param workspaceRoot Absolute workspace root path.
 * @param configObject The migrated config object (e.g. `{ tasks, namedInputs }`).
 * @param rendered The full rendered `vis.config.ts` used when the file is created or overwritten.
 * @param options Migration options.
 * @param options.dryRun When true, preview `rendered` instead of writing.
 * @param options.force When true, overwrite an existing file (a `.bak` is taken first).
 * @param options.useEditorconfig When false, skip `.editorconfig` discovery for indent.
 * @param logger Logger for user feedback.
 * @param report Migration report to append warnings/manual steps to.
 * @returns What happened to the file.
 */
export const mergeOrWriteVisConfig = (
    workspaceRoot: string,
    configObject: Record<string, unknown>,
    rendered: string,
    options: { dryRun?: boolean; force?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): VisConfigWriteOutcome => {
    const visConfigPath = join(workspaceRoot, "vis.config.ts");
    const exists = isAccessibleSync(visConfigPath);

    if (options.dryRun) {
        logger.info("── vis.config.ts (preview) ──");
        logger.info(rendered);
        logger.info("── end preview ──");

        return "preview";
    }

    if (!exists) {
        writeFileSync(visConfigPath, rendered);
        logger.info(`Wrote ${visConfigPath}`);

        return "written";
    }

    if (options.force) {
        backupFile(visConfigPath, report);
        logger.info(`Replacing ${visConfigPath} (backup at ${visConfigPath}.bak)`);
        writeFileSync(visConfigPath, rendered);

        return "written";
    }

    // File exists and no --force: merge each key the file doesn't already have.
    let content = readFileSync(visConfigPath);
    const inserted: string[] = [];
    const alreadyDefined: string[] = [];
    let anchorMissing = false;

    for (const [key, value] of Object.entries(configObject)) {
        const keyRe = new RegExp(String.raw`\b${key}\s*:`);

        if (keyRe.test(content)) {
            alreadyDefined.push(key);

            continue;
        }

        const snippet = renderConfigKeySnippet(key, value, visConfigPath, options.useEditorconfig);
        const updated = insertBlockIntoVisConfig(content, snippet);

        if (updated === undefined) {
            // No `defineConfig({` / `export default {` anchor — nothing more can
            // be inserted, so stop and report the remainder for manual merge.
            anchorMissing = true;

            break;
        }

        content = updated;
        inserted.push(key);
    }

    if (inserted.length > 0) {
        backupFile(visConfigPath, report);
        writeFileSync(visConfigPath, content);
        logger.info(`Merged ${inserted.join(", ")} into ${visConfigPath} (backup at ${visConfigPath}.bak).`);
    }

    for (const key of alreadyDefined) {
        const snippet = renderConfigKeySnippet(key, configObject[key], visConfigPath, options.useEditorconfig);

        report.warnings.push(`vis.config.ts already defines \`${key}\` — left untouched. Reconcile the migrated block manually:\n${snippet}`);
    }

    if (anchorMissing) {
        const unmerged = Object.keys(configObject).filter((key) => !inserted.includes(key) && !alreadyDefined.includes(key));
        const snippets = unmerged.map((key) => renderConfigKeySnippet(key, configObject[key], visConfigPath, options.useEditorconfig)).join(",\n");

        report.warnings.push(
            `vis.config.ts has no \`defineConfig({\` / \`export default {\` block to merge into — left untouched. Add the migrated block(s) manually:\n${snippets}`,
        );
    }

    if (alreadyDefined.length > 0 || anchorMissing) {
        const remaining = [...alreadyDefined, ...(anchorMissing ? Object.keys(configObject).filter((key) => !inserted.includes(key) && !alreadyDefined.includes(key)) : [])];

        report.manualSteps.push(
            `Merge the migrated ${remaining.join(", ")} block(s) into your existing vis.config.ts (the translated values are shown in the warnings above).`,
        );
    }

    return inserted.length > 0 ? "merged" : "skipped";
};

/**
 * Writes (or previews) a rendered `vis.config.ts`. Guards against
 * overwriting an existing file and logs the outcome.
 * @param workspaceRoot Absolute workspace root path.
 * @param rendered The full file content to write.
 * @param options Migration options.
 * @param options.dryRun When true, log the would-be file contents instead of writing.
 * @param options.force When true, overwrite an existing file (a `.bak` is taken first).
 * @param logger Logger for user feedback.
 * @param report Migration report to append warnings to.
 * @returns `true` if written (or previewed in dry-run), `false` if skipped.
 */
export const writeVisConfig = (
    workspaceRoot: string,
    rendered: string,
    options: { dryRun?: boolean; force?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): boolean => {
    const visConfigPath = join(workspaceRoot, "vis.config.ts");
    const exists = isAccessibleSync(visConfigPath);

    if (exists && !options.dryRun && !options.force) {
        logger.warn(
            "vis.config.ts already exists — refusing to overwrite. Re-run with --force to replace it (a .bak is taken first), or run with --dry-run to preview.",
        );
        report.warnings.push("vis.config.ts already exists; migration skipped writing the file. Re-run with --force to overwrite.");

        return false;
    }

    if (options.dryRun) {
        logger.info("── vis.config.ts (preview) ──");
        logger.info(rendered);
        logger.info("── end preview ──");
    } else {
        if (exists && options.force) {
            backupFile(visConfigPath, report);
            logger.info(`Replacing ${visConfigPath} (backup at ${visConfigPath}.bak)`);
        }

        writeFileSync(visConfigPath, rendered);
        logger.info(`Wrote ${visConfigPath}`);
    }

    return true;
};

/**
 * Reads and parses a JSON config file from the workspace root.
 * @param workspaceRoot Absolute workspace root path.
 * @param fileName File name relative to the workspace root.
 * @returns The parsed object, or `undefined` if the file doesn't exist.
 * @throws On JSON parse errors.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-supplied typed-cast convenience; the alternative is a verbose `as X | undefined` at every callsite
export const readJsonConfig = <T>(workspaceRoot: string, fileName: string): T | undefined => {
    const filePath = join(workspaceRoot, fileName);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(filePath)) as T;
    } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`, { cause: error });
    }
};
