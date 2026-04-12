import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import type { MigrateLogger, MigrationReport } from "./types";

/**
 * Serialises a config object to a pretty-printed TypeScript string with
 * unquoted keys (idiomatic TS style).
 */
export const serializeConfigObject = (obj: Record<string, unknown>): string => {
    return JSON.stringify(obj, null, 4).replaceAll(/"(\w+)":/g, "$1:");
};

/**
 * Wraps the vis.config.ts write-or-preview cycle shared by every
 * migration module. Handles the existence guard, dry-run preview, and
 * actual file write.
 *
 * Returns `true` if the file was written (or would have been written
 * in dry-run mode), `false` if an existing config prevented the write.
 */
export const writeVisConfig = (
    workspaceRoot: string,
    rendered: string,
    options: { dryRun?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): boolean => {
    const visConfigPath = join(workspaceRoot, "vis.config.ts");

    if (existsSync(visConfigPath) && !options.dryRun) {
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
 * Reads and parses a JSON config file. Returns `undefined` if the file
 * doesn't exist. Throws on parse errors.
 */
export const readJsonConfig = <T>(workspaceRoot: string, fileName: string): T | undefined => {
    const filePath = join(workspaceRoot, fileName);

    if (!existsSync(filePath)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(filePath, "utf8")) as T;
    } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`);
    }
};
