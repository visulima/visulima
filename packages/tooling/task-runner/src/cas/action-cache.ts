import { mkdir, readFile, rename, rm, utimes, writeFile } from "node:fs/promises";

import { dirname } from "@visulima/path";

import type { ActionResult } from "../backends/types";
import { uniqueId } from "../utils";
import { acEntryPath, taskHashIndexPath, tmpDirectory } from "./paths";

/**
 * Atomically write an `ActionResult` JSON entry. Existence of the
 * final file = commit, replacing the legacy `.commit` marker for v2
 * entries. tmp + rename means concurrent writers either both produce
 * the same logical entry (rename overwrite) or one wins cleanly.
 *
 * The serialised JSON is human-readable: easier to inspect when
 * something goes sideways during local cache debugging.
 */
export const writeActionEntry = async (root: string, actionHash: string, result: ActionResult): Promise<void> => {
    const finalPath = acEntryPath(root, actionHash);
    const tmpDirectoryPath = tmpDirectory(root);
    const stagingPath = `${tmpDirectoryPath}/${uniqueId()}`;

    await mkdir(tmpDirectoryPath, { recursive: true });
    await mkdir(dirname(finalPath), { recursive: true });

    const payload = `${JSON.stringify(result, null, 2)}\n`;

    await writeFile(stagingPath, payload);

    try {
        await rename(stagingPath, finalPath);
    } catch (error) {
        await rm(stagingPath, { force: true }).catch(() => {});

        throw error;
    }
};

/**
 * Read an `ActionResult` JSON entry. Returns `null` on miss or any
 * parse failure — the caller treats both as a cache miss and falls
 * back to executing the task. Touches the entry on hit so age-based
 * GC reflects real usage.
 */
export const readActionEntry = async (root: string, actionHash: string): Promise<ActionResult | null> => {
    const path = acEntryPath(root, actionHash);

    try {
        const content = await readFile(path, "utf8");
        const parsed = JSON.parse(content) as ActionResult;
        const now = new Date();

        await utimes(path, now, now).catch(() => {});

        return parsed;
    } catch {
        return null;
    }
};

/**
 * Persist the bridge from a task hash (xxh3-128) to an action digest
 * (sha256). Lets `Cache.get(taskHash)` jump straight to an AC entry
 * without recomputing the action proto. The bridge is a 64-byte plain
 * text file so it's trivial to read by hand and impossible to confuse
 * with a JSON payload.
 */
export const writeTaskHashIndex = async (root: string, taskHash: string, actionHash: string): Promise<void> => {
    const finalPath = taskHashIndexPath(root, taskHash);
    const tmpDirectoryPath = tmpDirectory(root);
    const stagingPath = `${tmpDirectoryPath}/${uniqueId()}`;

    await mkdir(tmpDirectoryPath, { recursive: true });
    await mkdir(dirname(finalPath), { recursive: true });
    await writeFile(stagingPath, actionHash);

    try {
        await rename(stagingPath, finalPath);
    } catch (error) {
        await rm(stagingPath, { force: true }).catch(() => {});

        throw error;
    }
};

/**
 * Resolve a task hash to its action digest via the bridge file.
 * Returns `null` when the bridge doesn't exist — caller falls through
 * to legacy lookup or executes the task.
 */
export const readTaskHashIndex = async (root: string, taskHash: string): Promise<string | null> => {
    try {
        const content = await readFile(taskHashIndexPath(root, taskHash), "utf8");
        const trimmed = content.trim();

        return trimmed.length > 0 ? trimmed : null;
    } catch {
        return null;
    }
};
