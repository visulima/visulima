import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { MigrateLogger, MigrationReport } from "./types";

/**
 * Serialises a config object to a pretty-printed TypeScript string with
 * unquoted keys (idiomatic TS style).
 * @param obj The configuration object to serialise.
 * @returns A JSON string with keys unquoted for TS readability.
 */
export const serializeConfigObject = (obj: Record<string, unknown>): string => JSON.stringify(obj, null, 4).replaceAll(/"(\w+)":/g, "$1:");

/**
 * Writes (or previews) a rendered `vis.config.ts`. Guards against
 * overwriting an existing file and logs the outcome.
 * @param workspaceRoot Absolute workspace root path.
 * @param rendered The full file content to write.
 * @param options Migration options (`dryRun` controls preview mode).
 * @param logger Logger for user feedback.
 * @param report Migration report to append warnings to.
 * @returns `true` if written (or previewed in dry-run), `false` if skipped.
 */
export const writeVisConfig = (
    workspaceRoot: string,
    rendered: string,
    options: { dryRun?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): boolean => {
    const visConfigPath = join(workspaceRoot, "vis.config.ts");

    if (isAccessibleSync(visConfigPath) && !options.dryRun) {
        logger.warn("vis.config.ts already exists — refusing to overwrite. Remove it first or run with --dry-run.");
        report.warnings.push("vis.config.ts already exists; migration skipped writing the file.");

        return false;
    }

    if (options.dryRun) {
        logger.info("── vis.config.ts (preview) ──");
        logger.info(rendered);
        logger.info("── end preview ──");
    } else {
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
export const readJsonConfig = <T>(workspaceRoot: string, fileName: string): T | undefined => {
    const filePath = join(workspaceRoot, fileName);

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(filePath)) as T;
    } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`);
    }
};
